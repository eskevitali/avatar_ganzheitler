"""Latest user request: empty transparent mouth; preserve source and all lip keys."""
import bpy,bmesh,pathlib,json
R=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');s=bpy.data.scenes['USER_MASK_ADAPTATION'];bpy.context.window.scene=s;m=bpy.data.objects['UserAcceptedMask'];s.frame_set(1)
if m.get('mouth_open_v1'):raise RuntimeError('Already opened')
before={k.name:[v.co.copy()for v in k.data]for k in m.data.shape_keys.key_blocks};removed=[];rear=[];uv=m.data.uv_layers['UVMap']
for p in m.data.polygons:
 internal=m.data.materials[p.material_index].name.startswith('UserMouthInterior')
 c=sum((before['Basis'][i]for i in p.vertices),__import__('mathutils').Vector())/len(p.vertices)
 posterior=not internal and c.y>.005 and abs(c.x-.003)<.055 and 1.55<c.z<1.65
 if internal or posterior:
  removed.append(p.index)
  if posterior:rear.append([{'position':[before['Basis'][m.data.loops[j].vertex_index].x,before['Basis'][m.data.loops[j].vertex_index].z,-before['Basis'][m.data.loops[j].vertex_index].y],'uv':[uv.data[j].uv.x,1-uv.data[j].uv.y]}for j in p.loop_indices])
assert rear and len(rear)<300
assert max(v['position'][2]for face in rear for v in face)<.01,'rear cut must never include frontal lips'
bm=bmesh.new();bm.from_mesh(m.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.faces[i]for i in removed],context='FACES_ONLY');bm.to_mesh(m.data);bm.free();m.data.update()
assert len(m.data.vertices)==len(before['Basis'])
maximum=max((k.data[i].co-before[k.name][i]).length for k in m.data.shape_keys.key_blocks for i in range(len(k.data)));assert maximum==0
m['mouth_open_v1']=True
report={'user_criterion':'transparent empty aperture; no visible tongue/cavity/teeth proxies','removed_visible_faces':len(removed),'removed_posterior_faces':len(rear),'removed_posterior_face_loops':rear,'all_neutral_and_68_shape_key_coordinates_max_change_m':maximum,'shape_keys_retained':len(m.data.shape_keys.key_blocks)-1,'source_unchanged':'mask_user_mouth_fix.blend retained; result saved separately','geometry_rule':'delete intraoral helpers and only deep posterior faces, retain external and inner lip-rim faces'}
(R/'blender/user-mask/mouth-open-report.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(R/'blender/user-mask/mask_user_mouth_open.blend'),compress=True);print(json.dumps({k:v for k,v in report.items()if k!='removed_posterior_face_loops'}))
