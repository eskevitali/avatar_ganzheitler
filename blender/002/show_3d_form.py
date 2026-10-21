import bpy,json
from mathutils import Vector
scene=bpy.data.scenes['002_MASK_WORKSHOP'];bpy.context.window.scene=scene;scene.frame_set(1)
mesh=next(o for o in bpy.data.collections['002_MASK_GEOMETRY'].objects if o.type=='MESH')
for obj in bpy.context.selected_objects:obj.select_set(False)
mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
for obj in bpy.data.collections['002_REFERENCE_AND_CONTROLS'].objects:obj.hide_set(True)
for obj in bpy.data.collections['002_STUDIO'].objects:obj.hide_set(True)
areas=[a for a in bpy.context.window.screen.areas if a.type=='VIEW_3D']
if not areas:
 area=max(bpy.context.window.screen.areas,key=lambda a:a.width*a.height);area.type='VIEW_3D';areas=[area]
area=max(areas,key=lambda a:a.width*a.height);space=area.spaces.active
space.shading.type='SOLID';space.shading.color_type='SINGLE';space.shading.single_color=(.30,.49,.64);space.shading.light='STUDIO';space.shading.show_shadows=True;space.shading.show_cavity=True
space.overlay.show_floor=False;space.overlay.show_axis_x=False;space.overlay.show_axis_y=False;space.overlay.show_extras=False
r=space.region_3d;r.view_location=(0,-.045,1.67);r.view_distance=.51;r.view_rotation=bpy.data.objects['002_CAMERA_25_DEG'].rotation_euler.to_quaternion();r.view_perspective='PERSP'
area.tag_redraw();bpy.context.view_layer.update()
print(json.dumps({'scene':scene.name,'visible_editor':area.type,'shading':space.shading.type,'pose_frame':scene.frame_current,'active_object':mesh.name,'reference_hidden_only_in_viewport':True,'view_angle':'25 degrees','area_size':[area.width,area.height]}))
