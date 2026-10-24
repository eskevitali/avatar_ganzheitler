import bpy,pathlib,json
R=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');m=bpy.data.objects['UserAcceptedMask'];s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s
assert m.get('mouth_cavity_v1')and not m.get('tongue_round_v1'),'Use the verified pre-rounding working copy'
for mat in m.data.materials:
 if mat.name.startswith('UserMouthInteriorTongue'):
  bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Alpha'].default_value=.062;bs.inputs['Emission Strength'].default_value=.03;mat.diffuse_color=(*mat.diffuse_color[:3],.062)
  try:mat.surface_render_method='DITHERED'
  except AttributeError:pass
 if mat.name.startswith('UserMouthInteriorCavity'):
  bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');color=(.001,.003,.006,1);bs.inputs['Base Color'].default_value=color;bs.inputs['Emission Color'].default_value=(0,0,0,1);bs.inputs['Emission Strength'].default_value=0;mat.diffuse_color=color
m['tongue_alpha_relative_to_face']=.1
bpy.ops.wm.save_as_mainfile(filepath=str(R/'blender/user-mask/mask_user_mouth_fix.blend'),compress=True)
report=json.loads((R/'blender/user-mask/mouth-correction-report.json').read_text())
for key in ['tongue_width_m','tongue_added_depth_m','tongue_transverse_dome_m','tongue_and_cavity_normals','rounding_outside_vertex_change_m']:report.pop(key,None)
report.update(latest_user_requirement='nearly invisible tongue, alpha one tenth of face',tongue_reference_alpha=.062,tongue_runtime_alpha='face opacity *0.1',tongue_emission_strength=.03,additional_rounding_applied=False,geometry_preserved_from='verified working candidate214db2d53024',cavity='concave, non-emissive near-black interior to avoid a replacement grey plate');(R/'blender/user-mask/mouth-correction-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Saved tongue alpha .062, same verified geometry and drivers')
