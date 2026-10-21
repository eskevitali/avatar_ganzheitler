"""Blender-native edit of ONLY the independent outer strand components.
All facial vertices, accepted eyes/brows, UVs and morph names remain untouched.
"""
import bpy,random,math,json
from mathutils import Vector
scene=bpy.data.scenes['002_MASK_WORKSHOP'];bpy.context.window.scene=scene;scene.frame_set(1)
obj=next(o for o in bpy.data.collections['002_MASK_GEOMETRY'].objects if o.type=='MESH')
if obj.get('002_strands_refined'):raise RuntimeError('Already refined; do not compound geometry edits')
mesh=obj.data;adj={}
for p in mesh.polygons:
 if p.material_index!=3:continue
 for a,b in zip(p.vertices,list(p.vertices[1:])+[p.vertices[0]]):adj.setdefault(a,set()).add(b);adj.setdefault(b,set()).add(a)
seen=set();components=[]
for start in adj:
 if start in seen:continue
 todo=[start];part=[]
 while todo:
  i=todo.pop()
  if i in seen:continue
  seen.add(i);part.append(i);todo.extend(adj[i]-seen)
 components.append(part)
colors=mesh.color_attributes.active_color
alpha={}
for loop in mesh.loops:
 if loop.vertex_index in adj:alpha[loop.vertex_index]=colors.data[loop.index if colors.domain=='CORNER'else loop.vertex_index].color[3]
keys=mesh.shape_keys.key_blocks;basis=keys[0];rng=random.Random(22002);changed=0
for part in components:
 ordered=sorted(part,key=lambda i:(-alpha[i],i));rows=[ordered[j:j+2]for j in range(0,len(ordered),2)]
 if any(len(r)!=2 for r in rows):raise RuntimeError('Unexpected strand topology')
 start=(basis.data[rows[0][0]].co+basis.data[rows[0][1]].co)*.5
 radial=Vector((start.x/.11,0,(start.z-1.67)/.15));radial.normalize()
 tangent=Vector((-radial.z,0,radial.x))
 length=rng.uniform(.022,.050);end=start+radial*length+tangent*rng.uniform(-.012,.012);end.y=start.y+rng.uniform(-.010,.010)
 a=start;b=start+radial*.009+tangent*rng.uniform(-.008,.008);c=end-radial*.014+tangent*rng.uniform(-.006,.006);d=end
 for j,row in enumerate(rows):
  t=j/(len(rows)-1);p=a*(1-t)**3+b*3*(1-t)**2*t+c*3*(1-t)*t*t+d*t**3
  p+=tangent*(math.sin(t*math.pi*2)*.0018*math.sin(t*math.pi))
  derivative=(b-a)*3*(1-t)**2+(c-b)*6*(1-t)*t+(d-c)*3*t*t
  n=Vector((-derivative.z,0,derivative.x));n.normalize();half=.00015*(1-.86*t)
  for sign,i in zip([-1,1],row):
   target=p+n*(half*sign);offset=target-basis.data[i].co.copy()
   for key in keys:key.data[i].co+=offset
   mesh.vertices[i].co=basis.data[i].co
   changed+=1
obj['002_strands_refined']=True;obj['002_strands_edit_scope']='Only material slot 3; every facial vertex/UV/shape remains unchanged'
# Quiet, reference-matching preview: emission dominates, no studio washout.
for mat in [m for m in bpy.data.materials if m.name.startswith('002_PREVIEW_')]:
 nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
 tex=next((n for n in nodes if n.type=='TEX_IMAGE'),None)
 if tex:
  for link in list(bs.inputs['Base Color'].links):links.remove(link)
  darken=nodes.new('ShaderNodeMixRGB');darken.blend_type='MULTIPLY';darken.inputs[0].default_value=1;darken.inputs[2].default_value=(.12,.12,.12,1)
  links.new(tex.outputs['Color'],darken.inputs[1]);links.new(darken.outputs[0],bs.inputs['Base Color']);bs.inputs['Emission Strength'].default_value=.82
 elif 'Strands'in mat.name:
  bs.inputs['Emission Color'].default_value=(.008,.18,.40,1);bs.inputs['Emission Strength'].default_value=1.1
mesh.update();bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath='/home/violes/GPT_Project/avatar_ganzheitler/repo/blender/002/mask_002_working.blend',compress=True)
print(json.dumps({'strand_components':len(components),'edited_strand_vertices':changed,'facial_vertices_edited':0,'uvs_edited':0,'morph_names_preserved':len(keys)-1}))
