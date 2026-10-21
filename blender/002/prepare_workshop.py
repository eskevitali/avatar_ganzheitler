"""Create a separate Blender workshop without altering the user's original scene.
Run through the already-installed Blender MCP execute_code interface.
"""
import bpy, json, math, pathlib
from mathutils import Vector
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo')
OUT=ROOT/'blender/002';OUT.mkdir(exist_ok=True,parents=True)
if bpy.data.scenes.get('002_MASK_WORKSHOP'):
 raise RuntimeError('Workshop already exists; inspect/resume it instead of recreating user work')
original_scene=bpy.context.scene
scene=bpy.data.scenes.new('002_MASK_WORKSHOP');bpy.context.window.scene=scene
scene['original_scene_preserved']=original_scene.name
scene['status']='Work in progress — reference 002; eyes/brows accepted; mouth/profile validation pending'
model=bpy.data.collections.new('002_MASK_GEOMETRY');scene.collection.children.link(model)
guides=bpy.data.collections.new('002_REFERENCE_AND_CONTROLS');scene.collection.children.link(guides)
rigcol=bpy.data.collections.new('002_STUDIO');scene.collection.children.link(rigcol)
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/reference-mask-002/reference-mask.glb'))
imported=[o for o in bpy.data.objects if o not in before]
for obj in imported:
 for coll in list(obj.users_collection):coll.objects.unlink(obj)
 model.objects.link(obj)
meshes=[o for o in imported if o.type=='MESH']
for obj in meshes:
 for polygon in obj.data.polygons:polygon.use_smooth=True
 obj['reference']='002'
 obj['animation']='57 morph targets; texture and lip boundaries share deformed vertices'
# Preserve names/parents of every adapter node. An outer pivot moves the whole mask.
pivot=bpy.data.objects.new('002_MASK_PIVOT',None);model.objects.link(pivot);pivot.location=(0,0,1.67)
bpy.context.view_layer.update()
for obj in imported:
 if obj.parent is None:
  world=obj.matrix_world.copy();obj.parent=pivot;obj.matrix_world=world
# Reference is a viewport image empty, never a renderable portrait overlay.
image=bpy.data.images.load(str(ROOT/'assets/reference-mask-002/reference.png'),check_existing=True);image.name='002_REFERENCE_ORIGINAL';image.pack()
ref=bpy.data.objects.new('002_REFERENCE_IMAGE__VIEWPORT_ONLY',None);guides.objects.link(ref)
ref.empty_display_type='IMAGE';ref.data=image;ref.empty_display_size=.37;ref.location=(-.37,-.02,1.67);ref.rotation_euler=(math.pi/2,0,0);ref.empty_image_depth='BACK';ref.hide_render=True
ref['purpose']='Reference only — not a face or renderable plane'
# Preserve the registered line as an editable guide in Blender.
landmarks=json.loads((ROOT/'assets/reference-mask-002/landmarks.json').read_text())
curve=bpy.data.curves.new('002_MEASURED_LIP_SEAM','CURVE');curve.dimensions='3D';poly=curve.splines.new('POLY');poly.points.add(len(landmarks['mouthSeamPixels'])-1)
# Guide lies in reference plane, alongside the model, not over rendered lips.
for point,(x,y)in zip(poly.points,landmarks['mouthSeamPixels']):
 u=x/landmarks['imageWidth'];v=y/landmarks['imageHeight'];point.co=((u-.5)*.37-.37,-.025,1.67+(.5-v)*.37/landmarks['imageWidth']*landmarks['imageHeight'],1)
guide=bpy.data.objects.new('002_LIP_SEAM_REFERENCE_GUIDE',curve);guides.objects.link(guide);guide.hide_render=True
# Neutral imported checkpoint, before adding preview materials/controllers.
for im in bpy.data.images:
 if im.source=='FILE' and not im.packed_file:
  try:im.pack()
  except RuntimeError:pass
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.local-preview/mask_002_blender_import.blend'),compress=True)
# Blender preview alpha is a dedicated attribute: existing UV/COLOR_0 and shape keys
# stay unchanged for compatible later GLB export. The app has its own reveal shader.
WIDTH=[(.08,.055),(.13,.145),(.22,.205),(.34,.235),(.45,.240),(.54,.224),(.64,.199),(.73,.164),(.82,.108),(.88,.018)]
def width(v):
 for(a,b),(c,d)in zip(WIDTH,WIDTH[1:]):
  if a<=v<=c:return b+(d-b)*(v-a)/(c-a)
 return WIDTH[0][1]if v<.08 else WIDTH[-1][1]
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for obj in meshes:
 mat=obj.data.materials[0];original_name=mat.name.split('.')[0];obj['surface_role']=original_name
 attr=obj.data.attributes.get('002_preview_edge')or obj.data.attributes.new('002_preview_edge','FLOAT','POINT')
 uv=obj.data.uv_layers.active
 weights=[1.0]*len(obj.data.vertices)
 if original_name=='ReferenceMask':
  for loop in obj.data.loops:
   u,v=uv.data[loop.index].uv
   side=abs(u-.5355)/max(.01,width(v))+.018*math.sin(v*173)
   weights[loop.vertex_index]=(1-smooth(.66,1,side))*(1-smooth(.74,.875,v))*smooth(.08,.16,v)
 for i,w in enumerate(weights):attr.data[i].value=w
 # New material datablock per surface; original glTF material left intact.
 preview=bpy.data.materials.new('002_PREVIEW_'+original_name);preview.use_nodes=True
 try:preview.surface_render_method='DITHERED'
 except (AttributeError,TypeError):pass
 nodes=preview.node_tree.nodes;nodes.clear();links=preview.node_tree.links
 output=nodes.new('ShaderNodeOutputMaterial');output.location=(640,0)
 bsdf=nodes.new('ShaderNodeBsdfPrincipled');bsdf.location=(340,0)
 bsdf.inputs['Roughness'].default_value=.72;bsdf.inputs['Metallic'].default_value=0
 bsdf.inputs['Emission Strength'].default_value=.70 if original_name!='MouthInterior'else 0
 links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
 tex=next((n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE'),None)if mat.use_nodes else None
 if tex:
  t=nodes.new('ShaderNodeTexImage');t.image=tex.image;t.location=(-620,90)
  links.new(t.outputs['Color'],bsdf.inputs['Base Color']);links.new(t.outputs['Color'],bsdf.inputs['Emission Color'])
  edge=nodes.new('ShaderNodeAttribute');edge.attribute_name='002_preview_edge';edge.location=(-620,-170)
  mul=nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.location=(0,-120)
  links.new(t.outputs['Alpha'],mul.inputs[0]);links.new(edge.outputs['Fac'],mul.inputs[1]);links.new(mul.outputs[0],bsdf.inputs['Alpha'])
 elif original_name=='ReferenceStrands':
  bsdf.inputs['Base Color'].default_value=(.012,.24,.55,1);bsdf.inputs['Emission Color'].default_value=(.02,.38,.8,1);bsdf.inputs['Emission Strength'].default_value=1.5
  color=nodes.new('ShaderNodeVertexColor');color.layer_name=obj.data.color_attributes.active_color.name if obj.data.color_attributes.active_color else ''
  links.new(color.outputs['Alpha'],bsdf.inputs['Alpha'])
 else:
  bsdf.inputs['Base Color'].default_value=(.001,.003,.008,1)
 obj.data.materials[0]=preview
# Accessible pose controls drive the existing, contract-compatible shape keys.
controls=bpy.data.objects.new('002_POSE_CONTROLS',None);guides.objects.link(controls);controls.empty_display_type='PLAIN_AXES';controls.empty_display_size=.025;controls.location=(.30,0,1.48);controls.hide_render=True
props=['A','O','M','I','jaw','blink','smile','brow_raise','head_yaw_deg','head_pitch_deg']
for name in props:
 controls[name]=0.0;controls.id_properties_ui(name).update(min=-10 if name.startswith('head_')else 0,max=10 if name.startswith('head_')else 1)
expressions={
 'viseme_aa':'A','viseme_O':'O','viseme_PP':'M','viseme_I':'I',
 'jawOpen':'max(jaw,min(1,A*.85+O*.42+M*.02+I*.16))',
 'mouthOpen':'A*.45','mouthClose':'M*.55','mouthFunnel':'O*.8','mouthPucker':'O*.45',
 'mouthSmileLeft':'min(1,I*.7+smile)','mouthSmileRight':'min(1,I*.7+smile)',
 'mouthStretchLeft':'I*.35','mouthStretchRight':'I*.35',
 'eyeBlinkLeft':'blink','eyeBlinkRight':'blink','browInnerUp':'brow_raise'}
for obj in meshes:
 keys=obj.data.shape_keys
 if not keys or len(keys.key_blocks)!=58:raise RuntimeError('Missing imported morph contract on '+obj.name)
 for name,expr in expressions.items():
  key=keys.key_blocks.get(name)
  if not key:raise RuntimeError('Missing shape '+name)
  f=key.driver_add('value');d=f.driver;d.type='SCRIPTED'
  for prop in props:
   if prop in expr:
    var=d.variables.new();var.name=prop;var.type='SINGLE_PROP';var.targets[0].id=controls;var.targets[0].data_path='["'+prop+'"]'
  d.expression=expr
for index,prop in [(2,'head_yaw_deg'),(0,'head_pitch_deg')]:
 f=pivot.driver_add('rotation_euler',index);d=f.driver;v=d.variables.new();v.name='angle';v.targets[0].id=controls;v.targets[0].data_path='["'+prop+'"]';d.expression='angle*0.01745329252'
# Timeline: neutral, A/O/M/I, neutral, blink, jaw levels, light turn, neutral.
poses=[(1,{}),(20,{'A':1}),(40,{'O':1}),(60,{'M':1}),(80,{'I':1}),(100,{}),(112,{'blink':1}),(122,{}),(140,{'jaw':.25}),(155,{'jaw':.5}),(170,{'jaw':1}),(190,{'head_yaw_deg':8}),(210,{'head_yaw_deg':-8}),(230,{})]
for frame,pose in poses:
 for prop in props:controls[prop]=pose.get(prop,0.0);controls.keyframe_insert(data_path='["'+prop+'"]',frame=frame)
for frame,label in [(1,'Neutral'),(20,'A'),(40,'O'),(60,'M / PP'),(80,'I'),(112,'Blink'),(140,'Jaw 25%'),(155,'Jaw 50%'),(170,'Jaw 100%'),(190,'Turn +8'),(210,'Turn -8'),(230,'Neutral end')]:scene.timeline_markers.new(label,frame=frame)
scene.frame_start=1;scene.frame_end=230;scene.render.fps=25;scene.frame_set(1)
# Dedicated studio; no edit to the original Camera/Light/Cube or approved web hall.
world=bpy.data.worlds.new('002_STUDIO_WORLD');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.012,.017,.026,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
def camera(name,position,target):
 data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);rigcol.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=.38;return obj
front=camera('002_CAMERA_FRONT',(0,-1.5,1.67),(0,-.045,1.67));quarter=camera('002_CAMERA_25_DEG',(-.634,-1.36,1.68),(0,-.045,1.67));scene.camera=front
for name,position,power,size in [('002_KEY',(-.35,-.6,2.1),25,.6),('002_FILL',(.4,-.3,1.8),12,.45)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;obj=bpy.data.objects.new(name,data);rigcol.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,-.05,1.67))-obj.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES' if False else 'BLENDER_EEVEE';scene.render.resolution_x=960;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='Standard'
# Visible viewport opens on the reference alongside the real mask.
for obj in bpy.context.selected_objects:obj.select_set(False)
controls.select_set(True);bpy.context.view_layer.objects.active=controls
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  space=area.spaces.active;space.shading.type='MATERIAL';space.overlay.show_floor=False;space.overlay.show_axis_x=False;space.overlay.show_axis_y=False
  space.region_3d.view_distance=.75;space.region_3d.view_location=(-.13,-.04,1.67);space.region_3d.view_rotation=front.rotation_euler.to_quaternion();space.region_3d.view_perspective='ORTHO'
 for other in [area]:
  if other.type=='PROPERTIES':
   try:other.spaces.active.context='OBJECT'
   except TypeError:pass
exec(compile((OUT/'configure_materials.py').read_text(),str(OUT/'configure_materials.py'),'exec'),{'bpy':bpy})
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mask_002_working.blend'),compress=True)
print(json.dumps({'scene':scene.name,'original_scene':original_scene.name,'mesh_objects':[{'name':o.name,'vertices':len(o.data.vertices),'shape_keys':len(o.data.shape_keys.key_blocks)}for o in meshes],'reference_object':ref.name,'blend':str(OUT/'mask_002_working.blend'),'timeline_frames':230,'original_objects_preserved':all(bpy.data.objects.get(n)for n in ['Cube','Camera','Light'])},ensure_ascii=False))
