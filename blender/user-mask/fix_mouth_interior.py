"""Local intraoral correction. Run on accepted adaptation; save a separate file."""
import bpy,pathlib,json,hashlib
from mathutils import Vector
R=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s;m=bpy.data.objects['UserAcceptedMask'];s.frame_set(1);keys=m.data.shape_keys.key_blocks;b=keys['Basis'];groups={};g=''
for line in(R/'.local-preview/makehuman-source/base.obj').read_text().splitlines():
 t=line.split()
 if not t:continue
 if t[0]=='g':g=t[1]
 if t[0]=='f':
  for v in t[1:]:groups[int(v.split('/')[0])-1]=g
src=m.data.attributes['mh_source_index'].data;roles=m.data.attributes['mask_role'].data
ids={name:[i for i in range(len(b.data))if roles[i].value==1 and groups.get(src[i].value)==name]for name in ['helper-tongue','helper-upper-teeth','helper-lower-teeth']}
before={k.name:[v.co.copy()for v in k.data]for k in keys};outside=set(range(len(b.data)))-set(sum(ids.values(),[]))
for name,vertices in ids.items():
 center=Vector([(min(b.data[i].co[j]for i in vertices)+max(b.data[i].co[j]for i in vertices))*.5 for j in range(3)])
 for i in vertices:
  old=before['Basis'][i];p=old.copy()
  if name=='helper-tongue':p.x=center.x+(old.x-center.x)*.80;p.y=center.y+(old.y-center.y)*.90+.012;p.z=center.z+(old.z-center.z)*.70-.001
  elif name=='helper-upper-teeth':p.x=center.x+(old.x-center.x)*.74;p.y+=.006;p.z=1.6231904+(old.z-1.6231904)*.50
  else:p.x=center.x+(old.x-center.x)*.74;p.y+=.006;p.z=1.6108607+(old.z-1.6108607)*.45
  for k in keys:k.data[i].co=p+(before[k.name][i]-old)
  m.data.vertices[i].co=p
# Dedicated non-photo intraoral materials. Geometry is fixed, not merely hidden.
for name,color,emission in [('UserMouthInteriorTongue',(.035,.12,.18),.18),('UserMouthInteriorTeeth',(.08,.20,.27),.10)]:
 mat=bpy.data.materials.new(name);mat.use_nodes=True;mat.use_fake_user=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission;bs.inputs['Roughness'].default_value=.80;bs.inputs['Metallic'].default_value=0;mat.diffuse_color=(*color,1);m.data.materials.append(mat)
material_indices={'helper-tongue':len(m.data.materials)-2,'helper-upper-teeth':len(m.data.materials)-1,'helper-lower-teeth':len(m.data.materials)-1}
for p in m.data.polygons:
 name=groups.get(src[p.vertices[0]].value)if roles[p.vertices[0]].value==1 else None
 if name in ids and all(i in ids[name]for i in p.vertices):p.material_index=material_indices[name]
max_outside=max((k.data[i].co-before[k.name][i]).length for k in keys for i in outside);assert max_outside==0
max_delta_error=max(((k.data[i].co-b.data[i].co)-(before[k.name][i]-before['Basis'][i])).length for k in keys for vertices in ids.values()for i in vertices);assert max_delta_error<1e-6
report={'changed_regions':{name:len(v)for name,v in ids.items()},'outside_regions_max_coordinate_change_m':max_outside,'all_68_morph_delta_max_error_m':max_delta_error,'outer_lips_eyes_head_and_blink_unchanged':True,'uv_and_source_texture_unchanged':True,'tongue_driver':'existing jawOpen and viseme targets retained; no invented tongue speech track','changes':'tongue narrower, lower and deeper; tooth proxy thickness reduced and inset; dedicated 3D shaded materials instead of face-photo projection'}
(R/'blender/user-mask/mouth-correction-report.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(R/'blender/user-mask/mask_user_mouth_fix.blend'),compress=True)
# Camera/poses below are render-only and never saved into the accepted source.
for d in m.data.shape_keys.animation_data.drivers:d.mute=True
cam=s.camera;cam.location=(.003,-1.2,1.605);cam.rotation_euler=(Vector((.003,-.025,1.605))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.15;s.render.resolution_x=900;s.render.resolution_y=550;s.render.resolution_percentage=100
for pose,values in [('neutral',{}),('A',{'viseme_aa':.8}),('O',{'viseme_O':.85}),('I',{'viseme_I':.85}),('M',{'viseme_PP':.9})]:
 for k in keys:
  if k.name!='Basis':k.value=0
 for name,value in values.items():keys[name].value=value
 bpy.context.view_layer.update();s.render.filepath=str(R/('blender/user-mask/previews/mouth-after-'+pose+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps(report))
