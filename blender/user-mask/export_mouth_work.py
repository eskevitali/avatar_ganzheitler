import bpy,pathlib,json,shutil,sys
R=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');out=R/(sys.argv[sys.argv.index('--out')+1]if '--out'in sys.argv else 'assets/user-mask-mouth-work');out.mkdir(exist_ok=True);s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s;m=bpy.data.objects['UserAcceptedMask'];s.frame_set(1)
for k in m.data.shape_keys.key_blocks:
 if k.name!='Basis':k.value=0
bpy.context.view_layer.update();first={};uv=m.data.uv_layers['UVMap'];c=m.data.color_attributes['MaskEdge']
for l in m.data.loops:first.setdefault(l.vertex_index,tuple(uv.data[l.index].uv))
rows=[]
for i,p in enumerate(m.data.shape_keys.key_blocks['Basis'].data):
 if i in first:rows.append({'position':[p.co.x,p.co.z,-p.co.y],'uv':[first[i][0],1-first[i][1]],'alpha':c.data[i].color[3]})
(R/('blender/user-mask/edge-alpha-mouth-open.json'if '--out'in sys.argv else 'blender/user-mask/edge-alpha-mouth.json')).write_text(json.dumps(rows,separators=(',',':')))
preview=m.data.materials[0];m.data.materials[0]=bpy.data.materials['UserNeuralSurface']
for ob in bpy.context.selected_objects:ob.select_set(False)
for ob in bpy.data.collections['USER_ACCEPTED_MASK_EXPORT'].objects:
 if ob.name!='USER_MASK_POSES':ob.select_set(True)
bpy.context.view_layer.objects.active=m
bpy.ops.export_scene.gltf(filepath=str(out/'user-mask.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_skins=False,export_morph=True,export_morph_normal=False,export_normals=True,export_extras=True)
m.data.materials[0]=preview
for name in ['profile.json','LICENSE.txt']:shutil.copy2(R/'assets/user-mask'/name,out/name)
print('Exported separate mouth working profile',len(rows),'used vertices')
