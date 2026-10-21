import bpy,pathlib,json
root=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo/blender/002/previews')
scene=bpy.data.scenes['002_MASK_WORKSHOP'];bpy.context.window.scene=scene
scene.frame_set(1);scene.render.resolution_x=960;scene.render.resolution_y=960;scene.render.resolution_percentage=100
if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=32
for name,camera in [('front-neutral','002_CAMERA_FRONT'),('turn-25-neutral','002_CAMERA_25_DEG')]:
 scene.camera=bpy.data.objects[camera];scene.render.filepath=str(root/(name+'.png'));bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['002_CAMERA_FRONT'];scene.frame_set(1)
print(json.dumps({'renders':[str(root/'front-neutral.png'),str(root/'turn-25-neutral.png')],'geometry_is_real':True}))
