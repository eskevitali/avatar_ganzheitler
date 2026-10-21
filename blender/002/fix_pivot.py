import bpy
scene=bpy.data.scenes['002_MASK_WORKSHOP'];bpy.context.window.scene=scene;scene.frame_set(1);bpy.context.view_layer.update()
pivot=bpy.data.objects['002_MASK_PIVOT']
for child in pivot.children:child.matrix_parent_inverse=pivot.matrix_world.inverted()
bpy.context.view_layer.update()
print('Pivot inverse corrected; original mesh coordinates retained.')
