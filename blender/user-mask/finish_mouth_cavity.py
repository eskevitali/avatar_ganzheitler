import bpy,bmesh,pathlib,json,math
from mathutils import Vector
from mathutils.kdtree import KDTree
R=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s;m=bpy.data.objects['UserAcceptedMask'];s.frame_set(1)
if m.get('mouth_cavity_v1'):raise RuntimeError('Already corrected')
before={k.name:[v.co.copy()for v in k.data]for k in m.data.shape_keys.key_blocks};count=len(m.data.vertices)
# These are coarse MakeHuman fitting proxies, not a detailed tooth mesh.
faces=[p.index for p in m.data.polygons if m.data.materials[p.material_index].name.startswith('UserMouthInteriorTeeth')]
bm=bmesh.new();bm.from_mesh(m.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.faces[i]for i in faces],context='FACES_ONLY');bm.to_mesh(m.data);bm.free();m.data.update()
assert len(m.data.vertices)==count
for k in m.data.shape_keys.key_blocks:assert all((v.co-before[k.name][i]).length<1e-7 for i,v in enumerate(k.data))
# An actual concave oral shell blocks the projected rear mask surface.
verts=[];polys=[];segments=32;rings=8
for j in range(rings):
 r=1-j/rings
 for i in range(segments):
  a=2*math.pi*i/segments;verts.append((.003+r*.046*math.cos(a),-.025+.045*math.sqrt(1-r*r),1.605+r*.030*math.sin(a)))
for j in range(rings-1):
 for i in range(segments):polys.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
center=len(verts);verts.append((.003,.020,1.605))
for i in range(segments):polys.append(((rings-1)*segments+i,(rings-1)*segments+(i+1)%segments,center))
mesh=bpy.data.meshes.new('MouthCavityShell');mesh.from_pydata(verts,[],polys);mesh.update();shell=bpy.data.objects.new('MouthCavityShell',mesh);s.collection.objects.link(shell)
mat=bpy.data.materials.new('UserMouthInteriorCavity');mat.use_nodes=True;mat.use_fake_user=True;bs=mat.node_tree.nodes.get('Principled BSDF');color=(.009,.030,.050,1);bs.inputs['Base Color'].default_value=color;bs.inputs['Emission Color'].default_value=color;bs.inputs['Emission Strength'].default_value=.16;bs.inputs['Roughness'].default_value=.95;mesh.materials.append(mat)
uv=mesh.uv_layers.new(name='UVMap')
for x in uv.data:x.uv=(.5,.5)
c=mesh.color_attributes.new(name='MaskEdge',domain='POINT',type='FLOAT_COLOR')
for x in c.data:x.color=(1,1,1,1)
role=mesh.attributes.new('mask_role','INT','POINT')
for x in role.data:x.value=2
source=mesh.attributes.new('mh_source_index','INT','POINT')
for x in source.data:x.value=-1
# Transfer verified local rim movement; do not invent a tongue articulation track.
ids=[i for i,p in enumerate(before['Basis'])if abs(p.x-.003)<.052 and 1.57<p.z<1.64 and p.y<-.035]
kd=KDTree(len(ids))
for i in ids:kd.insert(before['Basis'][i],i)
kd.balance();weights=[]
for v in verts:
 near=kd.find_n(Vector(v),4);w=[1/(d+.004)**2 for co,i,d in near];total=sum(w);weights.append([(near[j][1],w[j]/total)for j in range(len(w))])
shell.shape_key_add(name='Basis',from_mix=False)
for name,coordinates in before.items():
 if name=='Basis':continue
 key=shell.shape_key_add(name=name,from_mix=False);key.value=0
 for j,v in enumerate(verts):key.data[j].co=Vector(v)+sum(((coordinates[i]-before['Basis'][i])*w for i,w in weights[j]),Vector())
for o in bpy.context.selected_objects:o.select_set(False)
m.select_set(True);shell.select_set(True);bpy.context.view_layer.objects.active=m;bpy.ops.object.join();m=bpy.context.object
maximum=max((k.data[i].co-before[k.name][i]).length for k in m.data.shape_keys.key_blocks for i in range(count));assert maximum<1e-7
m['mouth_cavity_v1']=True
report=json.loads((R/'blender/user-mask/mouth-correction-report.json').read_text());report.update(removed_proxy_faces=len(faces),added_cavity_vertices=len(verts),added_cavity_faces=len(polys),post_join_original_vertices_max_change_m=maximum,cavity_drive='weighted deltas from four nearest accepted lip-rim vertices',stationary_photo_background_occluded_by='actual concave cavity geometry, not global darkening');(R/'blender/user-mask/mouth-correction-report.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(R/'blender/user-mask/mask_user_mouth_fix.blend'),compress=True)
# Close-up poses, no mutation to accepted source file.
for d in m.data.shape_keys.animation_data.drivers:d.mute=True
cam=s.camera;cam.location=(.003,-1.2,1.605);cam.rotation_euler=(Vector((.003,-.025,1.605))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.15;s.render.resolution_x=900;s.render.resolution_y=550;s.render.resolution_percentage=100
for pose,values in [('neutral',{}),('A',{'viseme_aa':.8}),('O',{'viseme_O':.85}),('I',{'viseme_I':.85}),('M',{'viseme_PP':.9}),('jaw-half',{'jawOpen':.5}),('jaw-full',{'jawOpen':1})]:
 for k in m.data.shape_keys.key_blocks:
  if k.name!='Basis':k.value=0
 for name,value in values.items():m.data.shape_keys.key_blocks[name].value=value
 bpy.context.view_layer.update();s.render.filepath=str(R/('blender/user-mask/previews/mouth-after-'+pose+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps(report))
