import bpy,pathlib,json
root=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo/blender/002/previews')
scene=bpy.data.scenes['002_MASK_WORKSHOP'];bpy.context.window.scene=scene;scene.camera=bpy.data.objects['002_CAMERA_FRONT']
for frame,name in [(20,'mouth-A'),(40,'mouth-O'),(60,'mouth-M'),(80,'mouth-I'),(112,'blink'),(155,'jaw-50')]:
 scene.frame_set(frame);scene.render.filepath=str(root/(name+'.png'));bpy.ops.render.render(write_still=True)
scene.frame_set(1)
print(json.dumps({'renders':['mouth-A','mouth-O','mouth-M','mouth-I','blink','jaw-50'],'neutral_restored':True}))
