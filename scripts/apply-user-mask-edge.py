"""Work around Blender 5's vertex-alpha export omission; change ALPHA BYTES ONLY.
Positions, UVs, normals, images, indices and every morph target stay byte-identical.
"""
import pathlib,json,struct,hashlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];path=ROOT/(sys.argv[1]if len(sys.argv)>1 else 'assets/user-mask/user-mask.glb');raw=bytearray(path.read_bytes());jlen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jlen]);bin_start=28+jlen
primitive=doc['meshes'][0]['primitives'][0];attrs=primitive['attributes'];color=doc['accessors'][attrs['COLOR_0']]
if color['type']!='VEC4' or color['componentType']not in [5121,5126]:raise RuntimeError('Unsupported exported edge color layout')
def vectors(index,width):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];stride=v.get('byteStride',width*4);start=bin_start+v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+'f'*width,raw,start+i*stride)for i in range(a['count'])]
positions=vectors(attrs['POSITION'],3);uv=vectors(attrs['TEXCOORD_0'],2);records=json.loads((ROOT/(sys.argv[2]if len(sys.argv)>2 else 'blender/user-mask/edge-alpha.json')).read_text());lookup={}
for row in records:lookup.setdefault(tuple(round(x,6)for x in row['position']),[]).append(row)
v=doc['bufferViews'][color['bufferView']];component=1 if color['componentType']==5121 else 4;stride=v.get('byteStride',4*component);start=bin_start+v.get('byteOffset',0)+color.get('byteOffset',0);before=bytes(raw);allowed=set();changed=0
for i,(p,t)in enumerate(zip(positions,uv)):
 rows=lookup.get(tuple(round(x,6)for x in p),[])
 if not rows:raise RuntimeError('Unmatched exported position')
 row=min(rows,key=lambda r:sum((a-b)**2 for a,b in zip(r['uv'],t)))
 if sum((a-b)**2 for a,b in zip(row['uv'],t))>1e-9:raise RuntimeError('UV registration mismatch')
 offset=start+i*stride+3*component;alpha=max(0,min(1,row['alpha']))
 if component==1:raw[offset]=round(alpha*255)
 else:struct.pack_into('<f',raw,offset,alpha)
 allowed.update(range(offset,offset+component));changed+=alpha<.95
actual=[i for i,(a,b)in enumerate(zip(before,raw))if a!=b]
if any(i not in allowed for i in actual):raise RuntimeError('Non-alpha data changed')
path.write_bytes(raw);report={'vertices':len(positions),'faded_vertices':changed,'changed_bytes':len(actual),'only_color_alpha_changed':True,'geometry_uv_morph_image_bytes_unchanged':True,'sha256':hashlib.sha256(raw).hexdigest()};(ROOT/('blender/user-mask/edge-transfer-mouth-report.json'if len(sys.argv)>1 else 'blender/user-mask/edge-transfer-report.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
