import json
print(json.dumps({'blender':bpy.app.version_string,'scene':bpy.context.scene.name,'has_saved_file':bool(bpy.data.filepath),'objects':[{'name':o.name,'type':o.type,'selected':o.select_get()}for o in bpy.context.scene.objects],'collections':[c.name for c in bpy.data.collections]},ensure_ascii=False))
