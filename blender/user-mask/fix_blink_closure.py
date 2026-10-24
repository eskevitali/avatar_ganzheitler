"""Local blink/UV correction. Run on the immutable adaptation at commit1e7d2f6.
Changes only two blink targets and eye-area UV; never changes Basis or source PNG.
"""
import bpy,math,pathlib,json
m=bpy.data.objects['UserAcceptedMask'];s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s;s.frame_set(1);b=m.data.shape_keys.key_blocks['Basis'];roles=m.data.attributes['mask_role'].data
smooth=lambda a,b,x: (lambda t:t*t*(3-2*t))(min(1,max(0,(x-a)/(b-a))))
for side,sign in [('Left',1),('Right',-1)]:
 k=m.data.shape_keys.key_blocks['eyeBlink'+side]
 for i,p in enumerate(b.data):
  x,y,z=p.co;d=k.data[i].co-p.co
  w=smooth(.022,.030,x*sign)*(1-smooth(.070,.082,x*sign))*(1-smooth(.018,.027,abs(z-1.685)))
  if y>-.015:w=0
  d*=w
  if d.z<-.0001:d.y-=.008*min(1,-d.z/.009)
  k.data[i].co=p.co+d
uv=m.data.uv_layers['UVMap']
changed=0
for loop in m.data.loops:
 if roles[loop.vertex_index].value:continue
 p=uv.data[loop.index].uv;u,v=p;vv=1-v
 for ax,ay,dx,dy in [(.6354,.3285,-.0164,.0525),(.4208,.3266,-.0078,.0474)]:
  r=((u-ax)/.090)**2+((vv-ay)/.110)**2;w=(1-smooth(.15,1.4,r))*smooth(.268,.315,vv)
  z=b.data[loop.vertex_index].co.z
  w*=smooth(1.653,1.665,z)*(1-smooth(1.695,1.704,z))
  if w>0:p.x+=dx*w;p.y-=dy*w;changed+=1
# Put the reference irises onto the actual separate globe surfaces.
group='';groups={}
for line in pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo/.local-preview/makehuman-source/base.obj').read_text().splitlines():
 t=line.split()
 if not t:continue
 if t[0]=='g':group=t[1]
 if t[0]=='f':
  for x in t[1:]:groups[int(x.split('/')[0])-1]=group
src=m.data.attributes['mh_source_index'].data
for sign,cx,cy in [(1,.619,.381),(-1,.413,.374)]:
 eye=[i for i,p in enumerate(b.data)if roles[i].value==1 and groups.get(src[i].value,'')in('helper-l-eye','helper-r-eye')and p.co.x*sign>0]
 front=[i for i in eye if b.data[i].co.y<-.0429]
 loops=[l.index for l in m.data.loops if l.vertex_index in front];center=sum((uv.data[j].uv for j in loops),__import__('mathutils').Vector((0,0)))/len(loops)
 shift=__import__('mathutils').Vector((cx,1-cy))-center
 for l in m.data.loops:
  if l.vertex_index in eye:uv.data[l.index].uv+=shift
 print('eye shift',sign,tuple(shift))

ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');PRE=ROOT/'blender/user-mask/previews';PRE.mkdir(exist_ok=True)
# Record exact invariants and local influence bounds before export.
violations={}
for side,sign in [('Left',1),('Right',-1)]:
 k=m.data.shape_keys.key_blocks['eyeBlink'+side];bad=[]
 for i,p in enumerate(b.data):
  if roles[i].value==0 and (p.co.x*sign<=.022 or p.co.z>=1.712 or p.co.z<=1.658):
   if (k.data[i].co-p.co).length>1e-7:bad.append(i)
 violations[side]=bad
assert not any(violations.values()),violations
report={'bridge_and_opposite_eye_delta_zero':True,'brow_and_nose_outside_local_eye_zone_delta_zero':True,'neutral_basis_changed_vertices':0,'source_image_pixels_changed':False,'uv_change_scope':'local eye area plus separate globe projection','uv_changed_loops':changed,'eye_geometry':'Existing closed socket topology, local blink depth correction; no retopology','shader_eye_hiding':False}
(ROOT/'blender/user-mask/blink-correction-report.json').write_text(json.dumps(report,indent=2)+'\n')
drivers=list(m.data.shape_keys.animation_data.drivers)
for d in drivers:d.mute=True
bs=next(n for n in m.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED');links=m.data.materials[0].node_tree.links;emissionLink=next(iter(bs.inputs['Emission Color'].links));sourceSocket=emissionLink.from_socket
for name,left,right,solid in [('blink-open',0,0,False),('blink-half',.5,.5,False),('blink-closed',1,1,False),('blink-left',1,0,False),('blink-right',0,1,False),('blink-solid-half',.5,.5,True),('blink-solid-closed',1,1,True)]:
 for key in m.data.shape_keys.key_blocks:
  if key.name!='Basis':key.value=0
 m.data.shape_keys.key_blocks['eyeBlinkLeft'].value=left;m.data.shape_keys.key_blocks['eyeBlinkRight'].value=right
 if solid:
  for link in list(bs.inputs['Emission Color'].links):links.remove(link)
  bs.inputs['Emission Color'].default_value=(.25,.25,.25,1)
 bpy.context.view_layer.update();s.render.resolution_x=700;s.render.resolution_y=700;s.render.resolution_percentage=100;s.render.filepath=str(PRE/(name+'.png'));bpy.ops.render.render(write_still=True)
links.new(sourceSocket,bs.inputs['Emission Color'])
for key in m.data.shape_keys.key_blocks:
 if key.name!='Basis':key.value=0
for d in drivers:d.mute=False
s.frame_set(1);bpy.context.view_layer.update()
preview=m.data.materials[0];portable=preview.copy();portable.name='UserNeuralSurface';portable.use_fake_user=True
bs=next(n for n in portable.node_tree.nodes if n.type=='BSDF_PRINCIPLED');tex=next(n for n in portable.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
for link in list(bs.inputs['Emission Color'].links):portable.node_tree.links.remove(link)
bs.inputs['Emission Color'].default_value=(0,0,0,1);bs.inputs['Emission Strength'].default_value=0
portable.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);m.data.materials[0]=portable
for o in bpy.context.selected_objects:o.select_set(False)
for o in bpy.data.collections['USER_ACCEPTED_MASK_EXPORT'].objects:
 if o.name!='USER_MASK_POSES':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/user-mask/user-mask.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_skins=False,export_morph=True,export_morph_normal=False,export_normals=True,export_extras=True)
m.data.materials[0]=preview;m['blink_closure_v2']=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/user-mask/mask_user_adaptation.blend'),compress=True)
exec(compile((ROOT/'blender/user-mask/read_edge_alpha.py').read_text(),'read_edge_alpha.py','exec'))
print(json.dumps(report))
