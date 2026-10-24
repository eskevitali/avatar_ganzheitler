"""Check new GLB against accepted adaptation, excluding the intended eye changes."""
import json,struct,pathlib,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(path):
 data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);binary=data[28+n:];return g,binary
old,ob=read(ROOT/'assets/user-mask/user-mask-49ca2e8a2ac4.glb');new,nb=read(ROOT/'assets/user-mask/user-mask.glb')
def acc(g,b,i):
 a=g['accessors'][i];size={5126:4,5125:4,5123:2,5121:1}[a['componentType']]*{'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 out=bytearray(size*a['count'])
 if 'bufferView'in a:
  v=g['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
  for j in range(a['count']):out[j*size:(j+1)*size]=b[offset+j*stride:offset+j*stride+size]
 if 'sparse'in a:
  sp=a['sparse'];ind=sp['indices'];iv=g['bufferViews'][ind['bufferView']];val=sp['values'];vv=g['bufferViews'][val['bufferView']];fmt={5121:'B',5123:'H',5125:'I'}[ind['componentType']];isize=struct.calcsize(fmt);io=iv.get('byteOffset',0)+ind.get('byteOffset',0);vo=vv.get('byteOffset',0)+val.get('byteOffset',0)
  for j in range(sp['count']):
   index=struct.unpack_from('<'+fmt,b,io+j*isize)[0];out[index*size:(index+1)*size]=b[vo+j*size:vo+(j+1)*size]
 return bytes(out)
p=old['meshes'][0]['primitives'][0];q=new['meshes'][0]['primitives'][0];names=old['meshes'][0]['extras']['targetNames'];assert names==new['meshes'][0]['extras']['targetNames']
for key in ['POSITION','NORMAL']:assert acc(old,ob,p['attributes'][key])==acc(new,nb,q['attributes'][key]),key
assert acc(old,ob,p['indices'])==acc(new,nb,q['indices']),'indices'
changed=[]
for i,name in enumerate(names):
 same=acc(old,ob,p['targets'][i]['POSITION'])==acc(new,nb,q['targets'][i]['POSITION'])
 if not same:changed.append(name)
assert set(changed)=={'eyeBlinkLeft','eyeBlinkRight'},changed
images=lambda g,b:[hashlib.sha256(b[g['bufferViews'][i['bufferView']].get('byteOffset',0):g['bufferViews'][i['bufferView']].get('byteOffset',0)+g['bufferViews'][i['bufferView']]['byteLength']]).hexdigest()for i in g['images']]
assert images(old,ob)==images(new,nb),'image changed'
report={'neutral_positions_exactly_equal':True,'neutral_normals_exactly_equal':True,'triangles_exactly_equal':True,'embedded_texture_bytes_exactly_equal':True,'changed_morphs':changed,'unchanged_morphs':len(names)-len(changed),'morph_count':len(names)}
(ROOT/'blender/user-mask/glb-regression-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
