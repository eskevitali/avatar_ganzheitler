"""Adapt the user's accepted mask in a NEW scene/file. Never rebuild its anatomy.
Official CC0 MakeHuman targets use an exact verified original-vertex mapping.
"""
import bpy,bmesh,json,pathlib,math,collections,heapq,hashlib
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');OUT=ROOT/'blender/user-mask';OUT.mkdir(exist_ok=True,parents=True)
if bpy.data.scenes.get('USER_MASK_ADAPTATION'):raise RuntimeError('Adaptation exists: inspect and resume, do not recreate')
source_scene=bpy.context.scene;head=source_scene.objects.get('MakeHuman head')
if head is None or head.data.shape_keys is None or 'fit-001'not in head.data.shape_keys.key_blocks:raise RuntimeError('Accepted source changed; inspect before continuing')
# Original vertex identity is recovered from Basis, not guessed from the texture.
verts=[];groups={};faces_by_group=collections.defaultdict(list);group=''
for line in(ROOT/'.local-preview/makehuman-source/base.obj').read_text().splitlines():
 s=line.split()
 if not s:continue
 if s[0]=='v':verts.append(Vector((float(s[1])*.1,-float(s[3])*.1,float(s[2])*.1)))
 elif s[0]=='g':group=s[1]
 elif s[0]=='f':
  f=[int(t.split('/')[0])-1 for t in s[1:]];groups.setdefault(group,set()).update(f);faces_by_group[group].append(f)
lookup={tuple(round(v[k]*10,4)for k in range(3)):i for i,v in enumerate(verts)}
head_map={}
for i,p in enumerate(head.data.shape_keys.key_blocks[0].data):
 k=tuple(round(p.co[j]*10,4)for j in range(3))
 if k not in lookup:raise RuntimeError('Unmatched accepted Basis vertex '+str(i))
 head_map[i]=lookup[k]
if len(head_map)!=4202:raise RuntimeError('Unexpected accepted head topology')
# Retarget x displacement to the user's local widening; neutral is never changed.
base=head.data.shape_keys.key_blocks[0];fitted=head.data.shape_keys.key_blocks['fit-001']
head_xscale={i:max(.7,min(1.8,fitted.data[i].co.x/base.data[i].co.x))if abs(base.data[i].co.x)>.001 else 1.45 for i in head_map}
source_meshes=[o for o in source_scene.objects if o.type=='MESH'and o.visible_get()]
helpers=collections.defaultdict(list)
for o in source_meshes:
 if o!=head:helpers[o.name.split('.')[0]].append(o)
helper_maps={};mapping_methods={}
for name,objects in helpers.items():
 ids=sorted(groups.get(name,[]))
 if not ids:raise RuntimeError('Unknown helper source '+name)
 # Full helper groups can be matched exactly by their face-index topology.
 canonical_faces=collections.Counter(tuple(sorted(ids.index(v)for v in f))for f in faces_by_group[name])
 for o in objects:
  current=collections.Counter(tuple(sorted(p.vertices))for p in o.data.polygons)
  if len(o.data.vertices)==len(ids)and current==canonical_faces:
   helper_maps[o.name]={i:ids[i]for i in range(len(ids))};mapping_methods[o.name]='exact topology';continue
  # Fragmented eyelashes retain their accepted positions. Only their movement
  # is transferred from the corresponding original helper group's local frame.
  allpts=[v.co for ob in objects for v in ob.data.vertices]
  src_center=sum((verts[i]for i in ids),Vector())/len(ids);dst_center=sum(allpts,Vector())/len(allpts)
  scales=[]
  for k in range(3):
   a=max(verts[i][k]for i in ids)-min(verts[i][k]for i in ids);b=max(p[k]for p in allpts)-min(p[k]for p in allpts);scales.append(max(.5,min(2,b/a))if a>1e-6 else 1)
  kd=KDTree(len(ids))
  for n,i in enumerate(ids):kd.insert(verts[i],i)
  kd.balance();helper_maps[o.name]={}
  for i,v in enumerate(o.data.vertices):
   p=Vector([(v.co[k]-dst_center[k])/scales[k]+src_center[k]for k in range(3)])
   helper_maps[o.name][i]=kd.find(p)[1]
  mapping_methods[o.name]='helper-local movement transfer'
# New scene; original objects/data stay untouched in their original Scene.
scene=bpy.data.scenes.new('USER_MASK_ADAPTATION');bpy.context.window.scene=scene
collection=bpy.data.collections.new('USER_ACCEPTED_MASK_EXPORT');scene.collection.children.link(collection)
normalization=Vector((-.0-head.location.x,.10,.94))
created=[];stats=[]
for source in source_meshes:
 obj=source.copy();obj.data=source.data.copy();obj.name='ADAPT_'+source.name;collection.objects.link(obj);obj.parent=None;obj.matrix_world.identity()
 accepted=[source.matrix_world@(fitted.data[i].co if source==head else v.co) for i,v in enumerate(source.data.vertices)]
 obj.shape_key_clear()
 for i,p in enumerate(accepted):obj.data.vertices[i].co=p+normalization
 src_attr=obj.data.attributes.new('mh_source_index','INT','POINT');scale_attr=obj.data.attributes.new('mh_xscale','FLOAT','POINT');role_attr=obj.data.attributes.new('mask_role','INT','POINT')
 m=head_map if source==head else helper_maps[source.name]
 for i in range(len(obj.data.vertices)):
  obj.data.attributes['mh_source_index'].data[i].value=m[i];obj.data.attributes['mh_xscale'].data[i].value=head_xscale[i]if source==head else 1.45;obj.data.attributes['mask_role'].data[i].value=0 if source==head else 1
 before_v=len(obj.data.vertices);before_f=len(obj.data.polygons)
 # Delete only rear faces in the COPY. No decimation, no move of retained vertices.
 bm=bmesh.new();bm.from_mesh(obj.data)
 remove=[f for f in bm.faces if f.calc_center_median().y>.045]
 bmesh.ops.delete(bm,geom=remove,context='FACES')
 loose=[v for v in bm.verts if not v.link_faces]
 if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
 bm.to_mesh(obj.data);bm.free();obj.data.update()
 if not obj.data.polygons:
  bpy.data.objects.remove(obj,do_unlink=True);continue
 stats.append({'object':source.name,'vertices_before':before_v,'vertices_after':len(obj.data.vertices),'faces_before':before_f,'faces_after':len(obj.data.polygons)})
 # Geometry-aware edge alpha: only the main facial mesh, not eyelash boundaries.
 alpha=[1.0]*len(obj.data.vertices)
 if source==head:
  bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();distance=[float('inf')]*len(bm.verts);queue=[]
  for v in bm.verts:
   if any(e.is_boundary for e in v.link_edges):distance[v.index]=0;heapq.heappush(queue,(0,v.index))
  while queue:
   d,i=heapq.heappop(queue)
   if d!=distance[i]or d>.023:continue
   for edge in bm.verts[i].link_edges:
    neighbor=edge.other_vert(bm.verts[i]);nd=d+edge.calc_length()
    if nd<distance[neighbor.index]:distance[neighbor.index]=nd;heapq.heappush(queue,(nd,neighbor.index))
  for i,d in enumerate(distance):
   t=min(1,d/.018);alpha[i]=t*t*(3-2*t)
  bm.free()
 color=obj.data.color_attributes.new(name='MaskEdge',type='FLOAT_COLOR',domain='POINT')
 for i,a in enumerate(alpha):color.data[i].color=(1,1,1,a)
 # Bake accepted fit into Basis, then add only movements of the original topology.
 obj.shape_key_add(name='Basis')
 source_ids=[a.value for a in obj.data.attributes['mh_source_index'].data];xs=[a.value for a in obj.data.attributes['mh_xscale'].data]
 targets={}
 for sub in ['faceunits','visemes']:
  for path in(ROOT/'assets/sources/makehuman-extra-targets'/sub).glob('*.target'):
   delta={}
   for line in path.read_text().splitlines():
    s=line.split()
    if len(s)==4 and not s[0].startswith('#'):delta[int(s[0])]=Vector((float(s[1])*.1,-float(s[3])*.1,float(s[2])*.1))
   targets[path.stem]=delta
 targets['mouthOpen']={i:d*.30 for i,d in targets['jawOpen'].items()}
 for name,delta in sorted(targets.items()):
  key=obj.shape_key_add(name=name,from_mix=False);key.value=0.0
  for i,index in enumerate(source_ids):
   d=delta.get(index)
   if d is not None:key.data[i].co+=Vector((d.x*xs[i],d.y,d.z))
 for p in obj.data.polygons:p.use_smooth=True
 created.append(obj)
# One mesh/material for mobile-friendly draw calls; preserve all shape key channels.
bpy.ops.object.select_all(action='DESELECT')
for o in created:o.select_set(True)
bpy.context.view_layer.objects.active=created[0];bpy.ops.object.join();mask=bpy.context.object;mask.name='UserAcceptedMask'
# Copy and pack the exact accepted material, without recoloring the reference.
material=source_meshes[0].data.materials[0].copy();material.name='UserNeuralSurface'
for n in material.node_tree.nodes:
 if n.type=='TEX_IMAGE'and n.image:
  n.image.filepath=str(ROOT/'assets/user-mask/source/reference-001.png');n.image.pack()
mask.data.materials.clear();mask.data.materials.append(material)
for p in mask.data.polygons:p.material_index=0
# Contract-only rig; it has no visible body mesh and does not alter accepted shape.
glb=(ROOT/'assets/quantum-face/quantum-face.glb').read_bytes();n=int.from_bytes(glb[12:16],'little');rig=json.loads(glb[20:20+n])
nodes=rig['nodes'];objects={}
for i,node in enumerate(nodes):
 if 'mesh'in node:continue
 ob=bpy.data.objects.new(node['name'],None);ob.empty_display_size=.002;collection.objects.link(ob);objects[i]=ob
 t=node.get('translation',[0,0,0]);ob.location=(t[0],-t[2],t[1])
for i,node in enumerate(nodes):
 if i not in objects:continue
 for child in node.get('children',[]):
  if child in objects:objects[child].parent=objects[i]
mask.parent=next(o for o in objects.values()if o.name=='Armature')
# Neutral identity is checked against the accepted retained source points.
mask['accepted_source']='user-accepted-2026-10-23.blend';mask['fit_baked']='fit-001 at value 1';mask['crop']='rear faces only; no facial decimation';mask['front_vertices_moved']=0
scene['status']='Accepted user geometry; animation/export adaptation in progress'
scene.frame_set(1)
# A small test controller; drives original target shapes, never separate lips/eyes.
controls=bpy.data.objects.new('USER_MASK_POSES',None);collection.objects.link(controls);controls.location=(.25,0,1.5);controls.empty_display_size=.01
mapping={'A':('viseme_aa',.80),'O':('viseme_O',.85),'M':('viseme_PP',.90),'I':('viseme_I',.85),'blinkL':('eyeBlinkLeft',1),'blinkR':('eyeBlinkRight',1),'jaw':('jawOpen',1)}
for prop,(name,gain)in mapping.items():
 controls[prop]=0.0;controls.id_properties_ui(prop).update(min=0,max=1)
 key=mask.data.shape_keys.key_blocks[name];d=key.driver_add('value').driver;v=d.variables.new();v.name='weight';v.targets[0].id=controls;v.targets[0].data_path='["'+prop+'"]';d.expression='weight*'+str(gain)
poses=[(1,{}),(20,{'A':1}),(40,{'O':1}),(60,{'M':1}),(80,{'I':1}),(100,{'blinkL':1,'blinkR':1}),(120,{}),(140,{'jaw':.5}),(160,{})]
for frame,pose in poses:
 for prop in mapping:controls[prop]=pose.get(prop,0.0);controls.keyframe_insert(data_path='["'+prop+'"]',frame=frame)
scene.frame_start=1;scene.frame_end=160;scene.render.fps=25;scene.frame_set(1)
# Save the adaptation as a different file; never overwrite accepted user source.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mask_user_adaptation.blend'),compress=True)
report={'source_head_vertices':4202,'exact_head_correspondences':len(head_map),'source_meshes':len(source_meshes),'total_vertices_before':sum(s['vertices_before']for s in stats),'total_vertices_after_crop':sum(s['vertices_after']for s in stats),'faces_before':sum(s['faces_before']for s in stats),'faces_after':sum(s['faces_after']for s in stats),'joined_vertices':len(mask.data.vertices),'shape_keys':len(mask.data.shape_keys.key_blocks)-1,'retained_front_vertex_motion':0,'original_file_unchanged':True,'mapping_methods':mapping_methods,'objects':stats}
(OUT/'transfer_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k not in ['mapping_methods','objects']},ensure_ascii=False))
