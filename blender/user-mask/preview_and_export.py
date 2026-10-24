import bpy,pathlib,json,math
from mathutils import Vector
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');OUT=ROOT/'assets/user-mask';PRE=ROOT/'blender/user-mask/previews';PRE.mkdir(exist_ok=True)
scene=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=scene;mask=bpy.data.objects['UserAcceptedMask']
# Studio and viewport live only in the adaptation scene.
studio=bpy.data.collections.get('USER_MASK_STUDIO')or bpy.data.collections.new('USER_MASK_STUDIO')
if studio.name not in scene.collection.children:scene.collection.children.link(studio)
def camera(name,position):
 ob=bpy.data.objects.get(name)
 if ob:return ob
 data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);studio.objects.link(ob);ob.location=position;ob.rotation_euler=(Vector((0,-.015,1.67))-ob.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=.32;return ob
front=camera('USER_MASK_FRONT',(0,-1.3,1.67));quarter=camera('USER_MASK_TURN',(-.56,-1.2,1.68));scene.camera=front
world=bpy.data.worlds.get('USER_MASK_WORLD')or bpy.data.worlds.new('USER_MASK_WORLD');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.015,.02,.03,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
if not bpy.data.objects.get('USER_MASK_SOFTBOX'):
 d=bpy.data.lights.new('USER_MASK_SOFTBOX','AREA');d.energy=8;d.size=.6;o=bpy.data.objects.new('USER_MASK_SOFTBOX',d);studio.objects.link(o);o.location=(-.25,-.5,2.0);o.rotation_euler=(Vector((0,0,1.67))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG'
# Separate preview material; the exact accepted texture remains packed/unmodified.
portable=bpy.data.materials['UserNeuralSurface'];old=bpy.data.materials.get('UserMaskPreview');
if old:bpy.data.materials.remove(old)
preview=portable.copy();preview.name='UserMaskPreview';preview.use_nodes=True
nodes=preview.node_tree.nodes;links=preview.node_tree.links
tex=next(n for n in nodes if n.type=='TEX_IMAGE'and n.image);bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.75
bs.inputs['Roughness'].default_value=.8
for link in list(bs.inputs['Base Color'].links):links.remove(link)
bs.inputs['Base Color'].default_value=(0,0,0,1);bs.inputs['Emission Strength'].default_value=1
try:preview.surface_render_method='DITHERED'
except AttributeError:pass
edge=nodes.new('ShaderNodeVertexColor');edge.layer_name='MaskEdge';links.new(edge.outputs['Alpha'],bs.inputs['Alpha'])
mask.data.materials[0]=preview
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  space=area.spaces.active;space.shading.type='MATERIAL';space.overlay.show_floor=False;space.overlay.show_axis_x=False;space.overlay.show_axis_y=False;space.overlay.show_extras=False;space.region_3d.view_location=(0,-.01,1.67);space.region_3d.view_distance=.44;space.region_3d.view_rotation=quarter.rotation_euler.to_quaternion();space.region_3d.view_perspective='PERSP'
for o in bpy.context.selected_objects:o.select_set(False)
mask.select_set(True);bpy.context.view_layer.objects.active=mask
for frame,name in [(1,'accepted-neutral'),(20,'accepted-A'),(100,'accepted-blink')]:
 scene.frame_set(frame);scene.camera=front;scene.render.filepath=str(PRE/(name+'.png'));bpy.ops.render.render(write_still=True)
scene.frame_set(1);scene.camera=quarter;scene.render.filepath=str(PRE/'accepted-turn.png');bpy.ops.render.render(write_still=True);scene.camera=front
# Explicit neutral values: old fit-key values must never leak into new morphs.
for key in mask.data.shape_keys.key_blocks:
 if key.name!='Basis':key.value=0.0
bpy.context.view_layer.update()
# Portable export: selected face and hidden contract nodes only, no studio/reference.
mask.data.materials[0]=portable
for o in bpy.context.selected_objects:o.select_set(False)
for o in bpy.data.collections['USER_ACCEPTED_MASK_EXPORT'].objects:
 if o.name!='USER_MASK_POSES':o.select_set(True)
bpy.context.view_layer.objects.active=mask
bpy.ops.export_scene.gltf(filepath=str(OUT/'user-mask.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_skins=False,export_morph=True,export_morph_normal=False,export_normals=True,export_extras=True)
mask.data.materials[0]=preview
for o in bpy.context.selected_objects:o.select_set(False)
mask.select_set(True);bpy.context.view_layer.objects.active=mask
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/user-mask/mask_user_adaptation.blend'),compress=True)
keys=['viseme_PP','viseme_aa','viseme_O','viseme_I','jawOpen','mouthClose','mouthOpen','mouthFunnel','mouthPucker','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight']
poses={name:{k:0 for k in keys}for name in ['PP','aa','O','I']}
for pose,key,value in [('PP','viseme_PP',.90),('aa','viseme_aa',.80),('O','viseme_O',.85),('I','viseme_I',.85)]:poses[pose][key]=value
manifest={'formatVersion':1,'id':'user-mask','name':'Ваша маска · Blender','model':'user-mask.glb','body':'F','cameraView':'head','appearance':{'type':'filaments','style':'user-mask','color':'#ffffff','opacity':.95,'brightness':1,'speed':.7,'amplitude':.00035,'activity':{'type':'neural-glow','strength':.5}},'defaults':{'mood':'neutral','lips':poses}}
(OUT/'profile.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(OUT/'LICENSE.txt').write_text('Accepted appearance/reference: user-supplied artwork and user-authored fitting, no new ownership claim.\nUnderlying MakeHuman base and official extra-targets: CC0-1.0; see assets/sources/makehuman and makehuman-extra-targets.\nSee source/checkpoint.json for untouched accepted source and texture hashes.\n')
print(json.dumps({'export':str(OUT/'user-mask.glb'),'morphs':len(mask.data.shape_keys.key_blocks)-1,'vertices':len(mask.data.vertices),'original_scene_present':'Scene'in bpy.data.scenes,'active_source':'adaptation copy','renders':str(PRE)}))
