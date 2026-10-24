"""Replace eye-look targets with globe-only rotation; accepted skin/blink untouched."""
import bpy,pathlib,json,math
from mathutils import Matrix,Vector
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');m=bpy.data.objects['UserAcceptedMask'];s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s;s.frame_set(1);b=m.data.shape_keys.key_blocks['Basis'];groups={};group=''
for line in(ROOT/'.local-preview/makehuman-source/base.obj').read_text().splitlines():
 t=line.split()
 if not t:continue
 if t[0]=='g':group=t[1]
 if t[0]=='f':
  for x in t[1:]:groups[int(x.split('/')[0])-1]=group
src=m.data.attributes['mh_source_index'].data;roles=m.data.attributes['mask_role'].data;counts={}
for side,sign in [('Left',1),('Right',-1)]:
 ids=[i for i,p in enumerate(b.data)if roles[i].value==1 and groups.get(src[i].value,'')in('helper-l-eye','helper-r-eye')and p.co.x*sign>0]
 center=Vector([(min(b.data[i].co[j]for i in ids)+max(b.data[i].co[j]for i in ids))*.5 for j in range(3)])
 for direction,axis,angleSign in [('Out','Z',sign),('In','Z',-sign),('Up','X',-1),('Down','X',1)]:
  name='eyeLook'+direction+side;k=m.data.shape_keys.key_blocks[name];rotation=Matrix.Rotation(math.radians(12)*angleSign,3,axis)
  for i,p in enumerate(b.data):k.data[i].co=p.co
  for i in ids:k.data[i].co=center+rotation@(b.data[i].co-center)
  counts[name]=len(ids)
  assert all((k.data[i].co-p.co).length==0 for i,p in enumerate(b.data)if i not in ids)
preview=m.data.materials[0];portable=bpy.data.materials.get('UserNeuralSurface')
if portable is None:raise RuntimeError('Portable material missing')
m.data.materials[0]=portable
for o in bpy.context.selected_objects:o.select_set(False)
for o in bpy.data.collections['USER_ACCEPTED_MASK_EXPORT'].objects:
 if o.name!='USER_MASK_POSES':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/user-mask/user-mask.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_skins=False,export_morph=True,export_morph_normal=False,export_normals=True,export_extras=True)
m.data.materials[0]=preview;bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/user-mask/mask_user_adaptation.blend'),compress=True)
report={'targets':counts,'full_target_degrees':12,'runtime_max_degrees':3,'skin_lids_bridge_affected_vertices':0,'neutral_geometry_changed':False,'blink_targets_changed':False,'uv_changed':False}
(ROOT/'blender/user-mask/eye-attention-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
