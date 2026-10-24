"""Bake the user's actual Object-coordinate projection at accepted neutral pose.
Does not change any geometry or the original material/mesh.
"""
import bpy,json,pathlib,hashlib
from mathutils import Vector,Matrix
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');scene=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=scene;scene.frame_set(1)
mask=bpy.data.objects['UserAcceptedMask'];head=bpy.data.objects['MakeHuman head'];source=bpy.data.materials['Sketch 001'];nodes=source.node_tree.nodes
projector=next(n for n in nodes if n.type=='TEX_COORD').object
if projector is None:raise RuntimeError('Expected accepted reference projector')
if projector.parent is not None:raise RuntimeError('Inspect parented reference transform before baking')
projector_world=Matrix.LocRotScale(projector.location,projector.rotation_euler.to_quaternion(),projector.scale)
transform=projector_world.inverted();norm=Vector((-head.location.x,.10,.94))
uv=mask.data.uv_layers['UVMap']
if mask.get('projection_revision')!=2:
 uvname=uv.name
 old_uv=[tuple(d.uv)for d in uv.data]
 if 'LegacyUVMap'not in mask.data.uv_layers:mask.data.uv_layers.new(name='LegacyUVMap')
 # Adding UV layers reallocates Blender CustomData: reacquire RNA handles.
 for i,value in enumerate(old_uv):mask.data.uv_layers['LegacyUVMap'].data[i].uv=value
 uv=mask.data.uv_layers[uvname]
 # Read exactly the current user's material constants, rather than guessing bounds.
 xdiv=nodes['Math'].inputs[1].default_value;ydiv=nodes['Math.001'].inputs[1].default_value;aspect=nodes['Math.002'].inputs[1].default_value
 xoffset=nodes['Math.003'].inputs[1].default_value;yoffset=nodes['Math.004'].inputs[1].default_value
 for loop in mask.data.loops:
  world=mask.matrix_world@mask.data.shape_keys.key_blocks[0].data[loop.vertex_index].co
  p=transform@(world-norm);uv.data[loop.index].uv=(p.x/xdiv+xoffset,p.y/ydiv/aspect+yoffset)
 uv.active_render=True;mask.data.uv_layers.active_index=0
 mask['accepted_projection_baked']=True;mask['projection_revision']=2
 mask['projection_source']='Exact Object-coordinate material of accepted 001-ref at neutral; UV fixed to deforming vertices'
# A conventional portable material, containing the exact same packed artwork.
mat=bpy.data.materials['UserNeuralSurface'];image=next(n.image for n in nodes if n.type=='TEX_IMAGE'and n.image)
mat.use_nodes=True;mat.node_tree.nodes.clear();n=mat.node_tree.nodes;links=mat.node_tree.links
out=n.new('ShaderNodeOutputMaterial');bs=n.new('ShaderNodeBsdfPrincipled');tex=n.new('ShaderNodeTexImage');tex.image=image;tex.extension='CLIP';uvnode=n.new('ShaderNodeUVMap');uvnode.uv_map=uv.name
links.new(uvnode.outputs['UV'],tex.inputs['Vector']);links.new(tex.outputs['Color'],bs.inputs['Base Color']);links.new(bs.outputs['BSDF'],out.inputs['Surface']);bs.inputs['Roughness'].default_value=.8
edge=n.new('ShaderNodeVertexColor');edge.layer_name='MaskEdge';links.new(edge.outputs['Alpha'],bs.inputs['Alpha']);mat.surface_render_method='DITHERED'
mask.data.materials[0]=mat
# Retained facial geometry is compared numerically, independently of the texture.
source_by_id={};originalverts=[]
for line in(ROOT/'.local-preview/makehuman-source/base.obj').read_text().splitlines():
 if line.startswith('v '):originalverts.append(tuple(map(float,line.split()[1:4])))
lookup={tuple(round(v,4)for v in p):i for i,p in enumerate(originalverts)}
base=head.data.shape_keys.key_blocks[0];fit=head.data.shape_keys.key_blocks['fit-001']
for i,p in enumerate(base.data):
 key=(round(p.co.x*10,4),round(p.co.z*10,4),round(-p.co.y*10,4));source_by_id[lookup[key]]=Matrix.LocRotScale(head.location,head.rotation_euler.to_quaternion(),head.scale)@fit.data[i].co+norm
role=mask.data.attributes['mask_role'];indices=mask.data.attributes['mh_source_index'];error=0;checked=0
for i,p in enumerate(mask.data.shape_keys.key_blocks[0].data):
 if role.data[i].value!=0:continue
 q=source_by_id[indices.data[i].value];error=max(error,(mask.matrix_world@p.co-q).length);checked+=1
if error>1e-6:raise RuntimeError('Accepted neutral geometry moved: '+str(error))
checkpoint=json.loads((ROOT/'assets/user-mask/source/checkpoint.json').read_text())
original_path=pathlib.Path(checkpoint['files'][0]['source']);original_hash=hashlib.sha256(original_path.read_bytes()).hexdigest()
if original_hash!=checkpoint['files'][0]['sha256']:raise RuntimeError('Source file changed externally; review before further work')
report={'retained_head_vertices_checked':checked,'max_accepted_front_error_m':error,'accepted_source_file_hash_unchanged':True,'projection_baked_from':projector.name,'old_unused_uv_preserved_as':'LegacyUVMap'}
(ROOT/'blender/user-mask/preservation_report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
