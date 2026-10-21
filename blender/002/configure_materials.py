"""Blender-native preview materials; preserve accepted UVs and all shape keys."""
import bpy,math
scene=bpy.data.scenes['002_MASK_WORKSHOP'];bpy.context.window.scene=scene
WIDTH=[(.08,.055),(.13,.145),(.22,.205),(.34,.235),(.45,.240),(.54,.224),(.64,.199),(.73,.164),(.82,.108),(.88,.018)]
def width(v):
 for(a,b),(c,d)in zip(WIDTH,WIDTH[1:]):
  if a<=v<=c:return b+(d-b)*(v-a)/(c-a)
 return WIDTH[0][1]if v<.08 else WIDTH[-1][1]
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
roles=['ReferenceMask','ReferenceEyes','MouthInterior','ReferenceStrands']
for obj in bpy.data.collections['002_MASK_GEOMETRY'].objects:
 if obj.type!='MESH':continue
 attr=obj.data.attributes.get('002_preview_edge')or obj.data.attributes.new('002_preview_edge','FLOAT','POINT')
 for a in attr.data:a.value=1
 uv=obj.data.uv_layers.active
 for polygon in obj.data.polygons:
  if polygon.material_index!=0:continue
  for li in polygon.loop_indices:
   u,v=uv.data[li].uv;v=1-v # glTF importer flips its top-origin v for Blender.
   side=abs(u-.5355)/max(.01,width(v))+.018*math.sin(v*173)
   attr.data[obj.data.loops[li].vertex_index].value=(1-smooth(.66,1,side))*(1-smooth(.74,.875,v))*smooth(.08,.16,v)
 for i,role in enumerate(roles):
  source=bpy.data.materials.get(role)
  preview=bpy.data.materials.get('002_PREVIEW_'+role)or bpy.data.materials.new('002_PREVIEW_'+role)
  preview.use_nodes=True;preview['export_role']=role
  preview.surface_render_method='DITHERED'
  nodes=preview.node_tree.nodes;nodes.clear();links=preview.node_tree.links
  out=nodes.new('ShaderNodeOutputMaterial');out.location=(650,0)
  bs=nodes.new('ShaderNodeBsdfPrincipled');bs.location=(360,0)
  bs.inputs['Roughness'].default_value=.78;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=.12
  links.new(bs.outputs[0],out.inputs['Surface'])
  tex=next((n for n in source.node_tree.nodes if n.type=='TEX_IMAGE'),None)if source and source.use_nodes else None
  if tex:
   t=nodes.new('ShaderNodeTexImage');t.image=tex.image;t.location=(-600,120)
   links.new(t.outputs['Color'],bs.inputs['Base Color']);links.new(t.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.65
   if role=='ReferenceMask':
    edge=nodes.new('ShaderNodeAttribute');edge.attribute_name='002_preview_edge';edge.location=(-600,-160)
    mul=nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.location=(0,-120)
    links.new(t.outputs['Alpha'],mul.inputs[0]);links.new(edge.outputs['Fac'],mul.inputs[1]);links.new(mul.outputs[0],bs.inputs['Alpha'])
   else:links.new(t.outputs['Alpha'],bs.inputs['Alpha'])
  elif role=='ReferenceStrands':
   bs.inputs['Base Color'].default_value=(.008,.18,.42,1);bs.inputs['Emission Color'].default_value=(.015,.30,.65,1);bs.inputs['Emission Strength'].default_value=1.8
   color=nodes.new('ShaderNodeVertexColor');color.layer_name=obj.data.color_attributes.active_color.name if obj.data.color_attributes.active_color else ''
   links.new(color.outputs['Alpha'],bs.inputs['Alpha'])
  else:bs.inputs['Base Color'].default_value=(.001,.003,.008,1)
  obj.data.materials[i]=preview
scene.frame_set(1)
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=960;scene.render.resolution_y=960
bpy.ops.wm.save_as_mainfile(filepath='/home/violes/GPT_Project/avatar_ganzheitler/repo/blender/002/mask_002_working.blend',compress=True)
print('All four surface materials configured; UV orientation corrected for preview alpha only. Geometry, accepted eyes/brows and UVs unchanged.')
