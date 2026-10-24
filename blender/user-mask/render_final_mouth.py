import bpy,pathlib
from mathutils import Vector
R=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s;m=bpy.data.objects['UserAcceptedMask'];s.frame_set(1)
for d in m.data.shape_keys.animation_data.drivers:d.mute=True
cam=s.camera;cam.location=(.003,-1.2,1.605);cam.rotation_euler=(Vector((.003,-.025,1.605))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.15;s.render.resolution_x=900;s.render.resolution_y=550;s.render.resolution_percentage=100
for pose,values in [('neutral',{}),('A',{'viseme_aa':.8}),('O',{'viseme_O':.85}),('I',{'viseme_I':.85}),('M',{'viseme_PP':.9}),('A-quarter',{'viseme_aa':.8})]:
 for k in m.data.shape_keys.key_blocks:
  if k.name!='Basis':k.value=0
 for name,v in values.items():m.data.shape_keys.key_blocks[name].value=v
 if pose=='A-quarter':cam.location=(-.6,-1.2,1.605);cam.rotation_euler=(Vector((.003,-.025,1.605))-cam.location).to_track_quat('-Z','Y').to_euler()
 bpy.context.view_layer.update();s.render.filepath=str(R/('blender/user-mask/previews/mouth-final-'+pose+'.png'));bpy.ops.render.render(write_still=True)
