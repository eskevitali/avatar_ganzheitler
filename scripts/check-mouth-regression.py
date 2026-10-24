"""Compare exported protected face vertices/morphs against accepted pre-mouth GLB."""
import pathlib,json,struct,hashlib,collections
R=pathlib.Path(__file__).resolve().parents[1];namespace={'__file__':str(R/'scripts/check-user-mask-regression.py')};source=(R/'scripts/check-user-mask-regression.py').read_text();exec(source[:source.index("p=old['meshes']")],namespace);read=namespace['read'];acc=namespace['acc']
old,ob=read(R/'assets/user-mask/user-mask-49c38f1fa339.glb');new,nb=read(R/'assets/user-mask-mouth-work/user-mask.glb');p=old['meshes'][0]['primitives'][0];q=new['meshes'][0]['primitives'][0];names=old['meshes'][0]['extras']['targetNames'];assert names==new['meshes'][0]['extras']['targetNames']
def vectors(g,b,a,width):return list(struct.iter_unpack('<'+'f'*width,acc(g,b,a)))
op=vectors(old,ob,p['attributes']['POSITION'],3);np=vectors(new,nb,q['attributes']['POSITION'],3);ou=vectors(old,ob,p['attributes']['TEXCOORD_0'],2);nu=vectors(new,nb,q['attributes']['TEXCOORD_0'],2);on=vectors(old,ob,p['attributes']['NORMAL'],3);nn=vectors(new,nb,q['attributes']['NORMAL'],3)
key=lambda p,u:tuple(round(v,6)for v in p+u);lookup={}
for i in range(len(op)):lookup.setdefault(key(op[i],ou[i]),[]).append(i)
matched=[];normal_error=0
for i,point in enumerate(np):
 options=lookup.get(key(point,nu[i]),[]);assert options,('new protected coordinate/UV',i)
 j=min(options,key=lambda j:sum((a-b)**2 for a,b in zip(on[j],nn[i])));normal_error=max(normal_error,max(abs(a-b)for a,b in zip(on[j],nn[i])));matched.append(j)
assert normal_error<1e-7,normal_error
def indices(g,b,i):
 a=g['accessors'][i];return [x[0]for x in struct.iter_unpack('<'+{5121:'B',5123:'H',5125:'I'}[a['componentType']],acc(g,b,i))]
available=set(key(p,u)for p,u in zip(np,nu));ko=[key(p,u)for p,u in zip(op,ou)];kn=[key(p,u)for p,u in zip(np,nu)];oi=indices(old,ob,p['indices']);ni=indices(new,nb,q['indices'])
ot=collections.Counter(tuple(sorted(ko[j]for j in oi[i:i+3]))for i in range(0,len(oi),3)if all(ko[j]in available for j in oi[i:i+3]));nt=collections.Counter(tuple(sorted(kn[j]for j in ni[i:i+3]))for i in range(0,len(ni),3));assert ot==nt,'protected face triangulation changed'
max_delta=0
for k,name in enumerate(names):
 a=vectors(old,ob,p['targets'][k]['POSITION'],3);b=vectors(new,nb,q['targets'][k]['POSITION'],3)
 max_delta=max(max_delta,max(abs(x-y)for i,j in enumerate(matched)for x,y in zip(a[j],b[i])))
assert max_delta<1e-6,max_delta
image_hashes=lambda g,b:[hashlib.sha256(b[g['bufferViews'][im['bufferView']].get('byteOffset',0):g['bufferViews'][im['bufferView']].get('byteOffset',0)+g['bufferViews'][im['bufferView']]['byteLength']]).hexdigest()for im in g['images']]
assert image_hashes(old,ob)==image_hashes(new,nb)
materials=[new['materials'][x['material']]['name']for x in new['meshes'][0]['primitives']];assert any(x.startswith('UserMouthInteriorTongue')for x in materials);assert any(x.startswith('UserMouthInteriorCavity')for x in materials)
report={'protected_exported_vertices':len(np),'protected_positions_uv_unchanged':True,'protected_triangles_unchanged':sum(nt.values()),'protected_normals_max_error':normal_error,'all_68_protected_morph_deltas_max_error':max_delta,'embedded_reference_texture_bytes_unchanged':True,'materials':materials,'triangles':sum(new['accessors'][x['indices']]['count']//3 for x in new['meshes'][0]['primitives'])};(R/'blender/user-mask/mouth-export-regression.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
