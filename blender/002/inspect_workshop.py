import json
scene=bpy.context.scene;objects=[]
for o in scene.objects:
 if o.type!='MESH':continue
 uv=o.data.uv_layers.active
 nearest=min(o.data.loops,key=lambda l:abs(o.data.vertices[l.vertex_index].co.x)+abs(o.data.vertices[l.vertex_index].co.z-1.67))
 objects.append({'name':o.name,'materials':[m.name for m in o.data.materials],'material_faces':{str(i):sum(p.material_index==i for p in o.data.polygons)for i in range(len(o.data.materials))},'sample_xyz':list(o.data.vertices[nearest.vertex_index].co),'sample_uv':list(uv.data[nearest.index].uv),'shape_keys':len(o.data.shape_keys.key_blocks),'bounds':[[min(v.co[k]for v in o.data.vertices),max(v.co[k]for v in o.data.vertices)]for k in range(3)]})
print(json.dumps({'scene':scene.name,'objects':objects},ensure_ascii=False))
