"""Export a separate candidate, preserving the editable Blender workshop.
Uses original portable materials; Blender-only preview nodes/controllers stay out.
"""
import bpy,pathlib,json
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');OUT=ROOT/'assets/reference-mask-002-blender';OUT.mkdir(exist_ok=True)
scene=bpy.data.scenes['002_MASK_WORKSHOP'];bpy.context.window.scene=scene;scene.frame_set(1);bpy.context.view_layer.update()
root=bpy.data.objects['Armature'];objects=[root]+list(root.children_recursive);meshes=[o for o in objects if o.type=='MESH']
parent=root.parent;inverse=root.matrix_parent_inverse.copy();basis=root.matrix_basis.copy();world=root.matrix_world.copy()
materials={o.name:list(o.data.materials)for o in meshes};selected=list(bpy.context.selected_objects);active=bpy.context.view_layer.objects.active
try:
 # Neutral root is at world zero. Exclude Blender preview pivot to preserve contract.
 root.parent=None;root.matrix_world=world;bpy.context.view_layer.update()
 for o in bpy.context.selected_objects:o.select_set(False)
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0]
 for o in meshes:
  for i,role in enumerate(['ReferenceMask','ReferenceEyes','MouthInterior','ReferenceStrands']):o.data.materials[i]=bpy.data.materials[role]
 bpy.ops.export_scene.gltf(filepath=str(OUT/'reference-mask.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_skins=False,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_extras=True,export_yup=True,export_apply=False,export_normals=True)
finally:
 root.parent=parent;root.matrix_parent_inverse=inverse;root.matrix_basis=basis
 for o in meshes:
  for i,mat in enumerate(materials[o.name]):o.data.materials[i]=mat
 for o in bpy.context.selected_objects:o.select_set(False)
 for o in selected:o.select_set(True)
 bpy.context.view_layer.objects.active=active;scene.frame_set(1);bpy.context.view_layer.update()
manifest=json.loads((ROOT/'assets/reference-mask-002/profile.json').read_text());manifest['id']='reference-mask-002-blender';manifest['name']='Маска 002 · Blender · кандидат'
(OUT/'profile.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(OUT/'LICENSE.txt').write_text((ROOT/'assets/reference-mask-002/LICENSE.txt').read_text())
print(json.dumps({'candidate_glb':str(OUT/'reference-mask.glb'),'installed_or_activated':False,'workshop_restored':True,'shape_keys':len(meshes[0].data.shape_keys.key_blocks)-1}))
