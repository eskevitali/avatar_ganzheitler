import bpy,json,pathlib
m=bpy.data.objects['UserAcceptedMask'];c=m.data.color_attributes['MaskEdge'];uv=m.data.uv_layers['UVMap'];rows=[];first_uv={}
for loop in m.data.loops:first_uv.setdefault(loop.vertex_index,tuple(uv.data[loop.index].uv))
for i,v in enumerate(m.data.shape_keys.key_blocks[0].data):rows.append({'position':[v.co.x,v.co.z,-v.co.y],'uv':[first_uv[i][0],1-first_uv[i][1]],'alpha':c.data[i].color[3]})
p=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo/blender/user-mask/edge-alpha.json');p.write_text(json.dumps(rows,separators=(',',':')))
print(json.dumps({'vertices':len(rows),'faded':sum(r['alpha']<.95 for r in rows),'geometry_or_scene_changed':False}))
