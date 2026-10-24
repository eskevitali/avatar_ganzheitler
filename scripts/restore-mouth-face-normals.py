"""Restore serialized normals of protected face after Blender joins intraoral shell."""
import pathlib,struct,json,sys
R=pathlib.Path(__file__).resolve().parents[1];ns={'__file__':str(R/'scripts/check-user-mask-regression.py')};s=(R/'scripts/check-user-mask-regression.py').read_text();exec(s[:s.index("p=old['meshes']")],ns);read=ns['read'];acc=ns['acc'];old,ob=read(R/'assets/user-mask/user-mask-49c38f1fa339.glb');path=R/(sys.argv[1]if len(sys.argv)>1 else 'assets/user-mask-mouth-work/user-mask.glb');new,nb=read(path);p=old['meshes'][0]['primitives'][0];q=new['meshes'][0]['primitives'][0]
def vectors(g,b,a,n):return list(struct.iter_unpack('<'+'f'*n,acc(g,b,a)))
op=vectors(old,ob,p['attributes']['POSITION'],3);ou=vectors(old,ob,p['attributes']['TEXCOORD_0'],2);on=vectors(old,ob,p['attributes']['NORMAL'],3);np=vectors(new,nb,q['attributes']['POSITION'],3);nu=vectors(new,nb,q['attributes']['TEXCOORD_0'],2);nn=vectors(new,nb,q['attributes']['NORMAL'],3);lookup={};key=lambda p,u:tuple(round(v,6)for v in p+u)
for i in range(len(op)):lookup.setdefault(key(op[i],ou[i]),[]).append(i)
raw=bytearray(path.read_bytes());jlen=struct.unpack_from('<I',raw,12)[0];a=new['accessors'][q['attributes']['NORMAL']];v=new['bufferViews'][a['bufferView']];start=28+jlen+v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);before=bytes(raw);allowed=set()
for i,point in enumerate(np):
 choices=lookup[key(point,nu[i])];j=min(choices,key=lambda j:sum((x-y)**2 for x,y in zip(on[j],nn[i])));offset=start+i*stride;struct.pack_into('<fff',raw,offset,*on[j]);allowed.update(range(offset,offset+12))
assert all(i in allowed for i,(x,y)in enumerate(zip(before,raw))if x!=y);path.write_bytes(raw);print('Restored protected normals',len(np))
