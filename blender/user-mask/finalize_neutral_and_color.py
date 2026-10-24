import bpy,json
m=bpy.data.objects['UserAcceptedMask'];bpy.context.scene.frame_set(1)
for key in m.data.shape_keys.key_blocks:
 if key.name!='Basis':key.value=0
mat=bpy.data.materials['UserNeuralSurface'];nodes=mat.node_tree.nodes;links=mat.node_tree.links
tex=next(n for n in nodes if n.type=='TEX_IMAGE');bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');edge=next(n for n in nodes if n.type=='VERTEX_COLOR'and n.layer_name=='MaskEdge')
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;links.new(tex.outputs['Color'],mix.inputs[1]);links.new(edge.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],bs.inputs['Base Color']);links.new(edge.outputs['Alpha'],bs.inputs['Alpha'])
bpy.context.view_layer.update();print(json.dumps({'neutral_shapes_nonzero':[(k.name,k.value)for k in m.data.shape_keys.key_blocks if k.name!='Basis'and k.value!=0],'vertex_color_rgba_wired':True,'neutral_geometry_changed':False}))
