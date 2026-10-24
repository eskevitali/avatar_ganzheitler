"""Reconstruct movement identities after Blender CustomData reallocation.
Neutral geometry is never moved; exact accepted-point matches are mandatory.
"""
import bpy,pathlib,json
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');source_scene=bpy.data.scenes['Scene'];head=source_scene.objects['MakeHuman head'];mask=bpy.data.objects['UserAcceptedMask'];bpy.context.scene.frame_set(1)
text=(ROOT/'blender/user-mask/prepare_export_copy.py').read_text();prefix=text[text.index('# Original vertex identity'):text.index('# New scene;')]
prefix=prefix.replace("o.type=='MESH'and o.visible_get()", "o.type=='MESH'")
namespace={'bpy':bpy,'ROOT':ROOT,'head':head,'source_scene':source_scene,'Vector':Vector,'KDTree':KDTree,'collections':__import__('collections')}
exec(compile(prefix,'mapping_source','exec'),namespace)
head_map=namespace['head_map'];helper_maps=namespace['helper_maps'];xs=namespace['head_xscale'];source_meshes=namespace['source_meshes']
norm=Vector((-head.location.x,.10,.94));kds={};payload={}
for role in [0,1]:
 records=[]
 for o in source_meshes:
  if (0 if o==head else 1)!=role:continue
  world=Matrix.LocRotScale(o.location,o.rotation_euler.to_quaternion(),o.scale)
  coordinates=head.data.shape_keys.key_blocks['fit-001'].data if o==head else o.data.vertices
  mapping=head_map if o==head else helper_maps[o.name]
  for i,v in enumerate(coordinates):records.append((world@v.co+norm,mapping[i],xs[i]if o==head else 1.45))
 kd=KDTree(len(records))
 for i,(p,index,scale)in enumerate(records):kd.insert(p,i)
 kd.balance();kds[role]=kd;payload[role]=records
basis=mask.data.shape_keys.key_blocks[0];roles=[x.value for x in mask.data.attributes['mask_role'].data];mapping=[];maximum=0
for i,p in enumerate(basis.data):
 role=roles[i];co,j,d=kds[role].find(mask.matrix_world@p.co);maximum=max(maximum,d);mapping.append(payload[role][j][1:])
if maximum>1e-6:raise RuntimeError('Not an exact accepted-point match: '+str(maximum))
# Reacquire attribute handles only after creation/reallocation has finished.
for i,(index,scale)in enumerate(mapping):
 mask.data.attributes['mh_source_index'].data[i].value=index
 mask.data.attributes['mh_xscale'].data[i].value=scale
paths=list((ROOT/'assets/sources/makehuman-extra-targets/faceunits').glob('*.target'))+list((ROOT/'assets/sources/makehuman-extra-targets/visemes').glob('*.target'));targets={}
for path in paths:
 delta={}
 for line in path.read_text().splitlines():
  s=line.split()
  if len(s)==4 and not s[0].startswith('#'):delta[int(s[0])]=Vector((float(s[1])*.1,-float(s[3])*.1,float(s[2])*.1))
 targets[path.stem]=delta
targets['mouthOpen']={i:d*.30 for i,d in targets['jawOpen'].items()};changes={}
for name,delta in targets.items():
 key=mask.data.shape_keys.key_blocks[name];key.value=0.0;count=0
 for i,(index,scale)in enumerate(mapping):
  d=delta.get(index,Vector());d=Vector((d.x*scale,d.y,d.z));key.data[i].co=basis.data[i].co+d
  if d.length>1e-7:count+=1
 changes[name]=count
mask.data.update()
report={'exact_accepted_points':len(mapping),'max_accepted_error_m':maximum,'source_index_unique':len(set(i for i,s in mapping)),'moving_vertices_A':changes['viseme_aa'],'moving_vertices_blinkL':changes['eyeBlinkLeft'],'moving_vertices_jaw':changes['jawOpen'],'neutral_geometry_changed':False}
(ROOT/'blender/user-mask/animation_mapping_report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
