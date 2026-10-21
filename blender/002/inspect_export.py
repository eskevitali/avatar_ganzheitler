import json
props=bpy.ops.export_scene.gltf.get_rna_type().properties
wanted=['filepath','export_format','use_selection','export_animations','export_skins','export_morph','export_morph_normal','export_morph_tangent','export_extras','export_yup','export_apply','export_normals','export_keep_originals']
print(json.dumps({k:{'type':props[k].type,'default':str(getattr(props[k],'default',''))}for k in wanted if k in props}))
