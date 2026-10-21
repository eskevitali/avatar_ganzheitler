print([p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties if 'scene'in p.identifier or 'selection'in p.identifier])
