import json
from mathutils import Vector
bpy.context.view_layer.update()
print(json.dumps({'objects':[{'name':o.name,'parent':o.parent.name if o.parent else None,'world_location':list(o.matrix_world.translation),'hide_render':o.hide_render,'world_bounds':[[min((o.matrix_world@v.co)[k]for v in o.data.vertices),max((o.matrix_world@v.co)[k]for v in o.data.vertices)]for k in range(3)]if o.type=='MESH'else None}for o in bpy.context.scene.objects if o.type=='MESH' or o.name in ['002_MASK_PIVOT','Armature','002_CAMERA_FRONT']]}))
