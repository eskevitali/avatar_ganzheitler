"""Extract only the CC0 head from official MakeHuman base.obj. No application code used."""
import json, pathlib, sys, hashlib
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'.local-preview/makehuman-source/base.obj'
verts=[];groups={};group=''
for line in source.read_text().splitlines():
 s=line.split()
 if not s:continue
 if s[0]=='v':verts.append(tuple(map(float,s[1:4])))
 elif s[0]=='g':group=s[1];groups.setdefault(group,[])
 elif s[0]=='f':groups.setdefault(group,[]).append([int(v.split('/')[0])-1 for v in s[1:]])
faces=[]
for f in groups['body']:
 p=[verts[i]for i in f]
 # Chin stays intact. The rear underside that connects to the neck is removed.
 if min(v[1]for v in p)<6.10:continue
 if sum(v[1]for v in p)/len(p)<6.65 and sum(v[2]for v in p)/len(p)<.95:continue
 faces.append(f)
ids=sorted({i for f in faces for i in f});mapping={i:j for j,i in enumerate(ids)}
landmarks={}
for key in ['joint-l-eye','joint-r-eye','joint-mouth','joint-jaw']:
 selected={i for f in groups[key]for i in f};landmarks[key]=[sum(verts[i][k]for i in selected)/len(selected)for k in range(3)]
out={'source':'https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'license':'CC0-1.0','vertices':[verts[i]for i in ids],'faces':[[mapping[i]for i in f]for f in faces],'landmarks':landmarks}
(root/'assets/sources/makehuman/head.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print(json.dumps({'headVertices':len(ids),'headPolygons':len(faces),'noBody':True,'license':'CC0-1.0'}))
# Safe anatomy diagnostics, no user data.
for y in [6.4,6.55,6.7,6.85,7,7.15,7.3]:
 candidates=[v for v in out['vertices'] if abs(v[0])<.08 and abs(v[1]-y)<.04]
 if candidates:print('midline',y,round(max(v[2]for v in candidates),4))
