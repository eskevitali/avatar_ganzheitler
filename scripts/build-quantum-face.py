"""CC0 anatomical head with original procedural filaments/morphs. Python stdlib only."""
import math, json, struct, random, pathlib
from math import sin, cos, pi, exp, sqrt
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/quantum-face';OUT.mkdir(parents=True,exist_ok=True)
rng=random.Random(41)
MORPHS=['viseme_PP','viseme_aa','viseme_O','viseme_I','jawOpen','mouthClose','mouthOpen','mouthFunnel','mouthPucker','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight','eyeBlinkLeft','eyeBlinkRight','eyeLookUpLeft','eyeLookUpRight','eyeLookDownLeft','eyeLookDownRight','eyeLookInLeft','eyeLookInRight','eyeLookOutLeft','eyeLookOutRight','browDownLeft','browDownRight','browInnerUp','browOuterUpLeft','browOuterUpRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','mouthFrownLeft','mouthFrownRight','jawForward','mouthLeft','mouthRight','mouthRollLower','mouthRollUpper','mouthShrugLower','mouthShrugUpper','mouthPressLeft','mouthPressRight','mouthDimpleLeft','mouthDimpleRight','mouthUpperUpLeft','mouthUpperUpRight','mouthLowerDownLeft','mouthLowerDownRight','noseSneerLeft','noseSneerRight','cheekPuff','cheekSquintLeft','cheekSquintRight','jawLeft','jawRight','tongueOut']
def gauss(x,y,cx,cy,sx,sy):return exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)
def width(v):
 anchors=[(-1,.022),(-.93,.040),(-.78,.062),(-.59,.078),(-.30,.098),(0,.109),(.28,.111),(.55,.102),(.76,.082),(.91,.056),(1,.014)]
 for (a,wa),(b,wb) in zip(anchors,anchors[1:]):
  if a<=v<=b:
   t=(v-a)/(b-a);t=t*t*(3-2*t);return wa+(wb-wa)*t
 return .004
def skin(x,y):
 v=y/.174;w=max(.004,width(v));z=.055*sqrt(max(0,1-(x/w)**2))
 # Forehead, temporal hollows, brow ridge, orbital sockets and malar volume.
 z+=.009*gauss(x,y,0,.105,.08,.065)
 z+=.010*(gauss(x,y,-.042,.059,.036,.012)+gauss(x,y,.042,.059,.036,.012))
 z-=.018*(gauss(x,y,-.045,.034,.027,.018)+gauss(x,y,.045,.034,.027,.018))
 z+=.012*(gauss(x,y,-.066,-.006,.029,.023)+gauss(x,y,.066,-.006,.029,.023))
 z-=.006*(gauss(x,y,-.070,-.055,.024,.029)+gauss(x,y,.070,-.055,.024,.029))
 # Narrow bridge, rounded tip, alar wings and actual dark nostril indentations.
 z+=.032*gauss(x,y,0,.016,.012,.043)+.041*gauss(x,y,0,-.019,.015,.014)
 z+=.018*(gauss(x,y,-.016,-.026,.010,.009)+gauss(x,y,.016,-.026,.010,.009))
 z-=.010*(gauss(x,y,-.013,-.032,.006,.0035)+gauss(x,y,.013,-.032,.006,.0035))
 z+=.005*gauss(x,y,0,-.045,.007,.015)
 z+=.011*gauss(x,y,0,-.063,.038,.011)
 z-=.004*gauss(x,y,0,-.086,.043,.008)
 z+=.014*gauss(x,y,0,-.117,.034,.022)
 return z
positions=[];uv=[];features=[];indices=[]
def ribbon(points,thickness,feature='skin',phase=0):
 if len(points)>20:points=points[::2]+[points[-1]]
 start=len(positions)
 for i,(x,y,z) in enumerate(points):
  prev=points[max(0,i-1)];nxt=points[min(len(points)-1,i+1)]
  dx=nxt[0]-prev[0];dy=nxt[1]-prev[1];l=max(1e-8,sqrt(dx*dx+dy*dy));nx=-dy/l*thickness*1.7;ny=dx/l*thickness*1.7
  for sign in [-1,1]:
   positions.append((x+sign*nx,y+sign*ny+1.67,z));uv.append((i/max(1,len(points)-1),phase));features.append(feature)
  if i: k=start+2*i;indices.extend([k-2,k-1,k,k-1,k+1,k])
def excluded(x,y):
 return any(((x-s*.045)/.027)**2+((y-.018781)/.012)**2<1 for s in [-1,1]) or (abs(x)<.036 and abs(y+.061)<.0045)
# Anatomical source: only a cropped CC0 MakeHuman head; no skin/body/hair assets.
head=json.loads((ROOT/'assets/sources/makehuman/head.json').read_text())
base=[tuple(v)for v in head['vertices']];polys=head['faces']
# The original CC0 head already has dense facial topology. Smooth vertex normals
# retain anatomy without multiplying all 57 morph texture layers by subdivision.
for p in base:
 x,y,z=p;x*=.14;y=(y-7.15)*.14;z=(z-.95)*.14
 for side in [-1,1]:
  weight=gauss(x,y,side*.043085,.018781,.024,.018)
  y+=(y-.018781)*weight*.20
 positions.append((x,y+1.67,z));uv.append((x/.26+.5,y/.35+.5));features.append('surface')
for f in polys:
 for i in range(1,len(f)-1):indices.extend([f[0],f[i],f[i+1]])
surface_index_count=len(indices);core_indices=list(indices)
surface_normals=[[0.,0.,0.]for _ in positions]
for i in range(0,len(indices),3):
 a,b,c=indices[i:i+3];u=[positions[b][k]-positions[a][k]for k in range(3)];v=[positions[c][k]-positions[a][k]for k in range(3)]
 normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
 for j in [a,b,c]:
  for k in range(3):surface_normals[j][k]+=normal[k]
for i,n in enumerate(surface_normals):
 length=sqrt(sum(k*k for k in n))or 1;surface_normals[i]=tuple(k/length for k in n)
# A front-surface spatial index binds separately built light threads to the head.
buckets={};cell=.006
for x,y,z in positions:
 if z<.02:continue
 y-=1.67;buckets.setdefault((round(x/cell),round(y/cell)),[]).append((x,y,z))
analytic_skin=skin
def skin(x,y):
 ix,iy=round(x/cell),round(y/cell);pts=[]
 for a in range(ix-1,ix+2):
  for b in range(iy-1,iy+2):pts.extend(buckets.get((a,b),[]))
 if not pts:return analytic_skin(x,y)
 closest=sorted(pts,key=lambda p:(p[0]-x)**2+(p[1]-y)**2)[:4]
 weights=[1/max(1e-8,(p[0]-x)**2+(p[1]-y)**2)for p in closest]
 return sum(p[2]*w for p,w in zip(closest,weights))/sum(weights)
# Sparse larger wandering threads provide real parallax and a luminous outer edge.
for strand in range(35):
 x=rng.uniform(-.10,.10);y=rng.uniform(-.14,.16);angle=rng.uniform(-pi,pi);pts=[]
 for step in range(65):
  side=1 if x>0 else -1;cx=side*.047;cy=.026 if y>-.01 else -.066
  tang=math.atan2(y-cy,x-cx)+pi/2
  target=tang if abs(x)>.025 else pi/2+.22*sin(y*40+strand)
  angle+=.20*math.atan2(sin(target-angle),cos(target-angle))+.16*sin(step*.6+strand)
  x+=.0012*cos(angle);y+=.0012*sin(angle)
  if abs(y)>.170 or abs(x)>width(y/.174)*.99 or excluded(x,y):break
  pts.append((x,y,skin(x,y)+.0012+.0007*sin(step*.3+strand)))
 if len(pts)>3:ribbon(pts,.000033,'skin',rng.random())
# Fine iris rings/rays in the actual anatomical eye apertures. The base head
# already supplies eyelids, nose and lips, so no cartoon outlines are overlaid.
for side in [-1,1]:
 tag='Left'if side>0 else'Right';cx=side*.043085;cy=.018781
 for ring in range(0):
  r=.0052+ring*.00055;pts=[]
  for i in range(73):
   a=i/72*2*pi;pts.append((cx+r*cos(a),cy+r*sin(a)*.78,.084+.001*cos(a)))
  ribbon(pts,.000065,'iris'+tag,ring*.09)
 for ray in range(36):
  a=ray/36*2*pi;pts=[]
  for i in range(7):
   r=.0052+.0022*i/6;pts.append((cx+r*cos(a),cy+r*sin(a)*.78,.084))
  ribbon(pts,.000050,'iris'+tag,ray/36)
# Local readable anatomy in light, never an opaque facial shell.
for side in [-1,1]:
 tag='Left'if side>0 else'Right';cx=side*.043085
 for upper in [True,False]:
  for layer in range(3):
   pts=[]
   for i in range(61):
    t=i/60;x=cx-.019+.038*t;y=.018781+(1 if upper else -1)*(.0045+layer*.00035)*sin(t*pi)**.7
    pts.append((x,y,skin(x,y)+.0015))
   ribbon(pts,.000032,('upperLid'if upper else'lowerLid')+tag,layer*.21)
 for layer in range(5):
  pts=[]
  for i in range(45):
   t=i/44;x=cx-.024+.048*t;y=.040+.004*sin(t*pi)+layer*.00040-side*.003*(t-.5)
   pts.append((x,y,skin(x,y)+.0015))
  ribbon(pts,.000030,'brow'+tag,layer*.17)
for upper in [True,False]:
 for layer in range(3):
  pts=[]
  for i in range(65):
   t=-1+2*i/64;x=.031*t;y=-.074+(1 if upper else-1)*(.0026+layer*.00050)*(1-t*t)
   if upper:y+=.0017*exp(-((abs(t)-.30)/.20)**2)
   pts.append((x,y,skin(x,y)+.0014))
  ribbon(pts,.000035,'upperLip'if upper else'lowerLip',layer*.19)
# A few smooth lifted filaments curl around the crown, not a visible hairstyle.
for j in range(24):
 a=rng.uniform(-pi*.62,pi*.62);pts=[]
 for i in range(70):
  t=i/69;angle=a+.055*sin(t*6+j);r=1+.08*sin(t*pi)+.018*sin(t*13+j)
  x=.110*sin(angle)*r;y=.162*cos(angle)*r
  pts.append((x,y,.021+.012*cos(t*2*pi+j)))
 ribbon(pts,.000028,'wisp',j/70)
# Each morph moves the ribbons themselves; no static texture or opaque skin shell.
def delta(name,p,feature):
 x,y,z=p;y-=1.67;dx=dy=dz=0.;left=not name.endswith('Right');side=1 if left else -1
 mouth=gauss(x,y,0,-.074,.053,.032);lower=1/(1+exp((y+.074)*180));eye=gauss(x,y,side*.043085,.018781,.030,.023)
 if name in ['jawOpen','mouthOpen','viseme_aa']:
  weight={'jawOpen':.024,'mouthOpen':.011,'viseme_aa':.014}[name];dy-=weight*mouth*lower;dz-=.004*mouth*lower
 if name=='mouthClose' or name=='viseme_PP':dy+=(.009 if name=='mouthClose' else .005)*mouth*(1 if y<-.074 else -.4)
 if name in ['mouthFunnel','mouthPucker','viseme_O']:dx-=x*mouth*.34;dz+=.010*mouth;dy-=.004*mouth*lower
 if name=='viseme_I':dx+=x*mouth*.25;dy+=.002*mouth
 if 'mouthSmile' in name:dy+=.012*gauss(x,y,side*.033,-.074,.025,.020);dx+=side*.006*mouth*max(0,side*x/.05)
 if 'mouthFrown' in name:dy-=.010*gauss(x,y,side*.033,-.074,.025,.020)
 if 'mouthStretch' in name:dx+=side*.012*mouth*max(0,side*x/.05)
 if name in ['mouthLeft','jawLeft']:dx+=.007*mouth
 if name in ['mouthRight','jawRight']:dx-=.007*mouth
 if name=='jawForward':dz+=.008*mouth
 if name.startswith('eyeBlink') or name.startswith('eyeSquint'):
  amount=1 if 'Blink' in name else .55
  if feature.endswith('Left' if left else 'Right') and any(s in feature for s in ['Lid','iris']):dy-=amount*(y-.018781)*.97
  else:dy-=amount*(y-.018781)*eye*.60
 if name.startswith('eyeWide'):dy+=(y-.018781)*eye*.55
 if name.startswith('eyeLook') and feature=='iris'+('Left' if left else 'Right'):
  if 'Up' in name:dy+=.003
  elif 'Down' in name:dy-=.003
  elif 'In' in name:dx-=side*.003
  else:dx+=side*.003
 if name.startswith('brow'):
  area=gauss(x,y,side*.044,.049,.038,.014)
  if name=='browInnerUp':area=gauss(x,y,0,.049,.037,.020)
  dy+=(-.010 if 'Down' in name else .013)*area
 if name.startswith('mouthRoll'):dz-=.004*mouth;dy+=.002*mouth
 if name.startswith('mouthShrug'):dy+=.005*mouth
 if name.startswith('mouthPress'):dz-=.003*mouth
 if name.startswith('mouthDimple'):dz-=.004*gauss(x,y,side*.04,-.054,.015,.015)
 if name.startswith('mouthUpperUp'):dy+=.006*mouth*(1-lower)
 if name.startswith('mouthLowerDown'):dy-=.006*mouth*lower
 if name.startswith('noseSneer'):dy+=.004*gauss(x,y,side*.023,-.020,.020,.020)
 if name.startswith('cheek'):dz+=.005*gauss(x,y,side*.065,-.012,.030,.025)
 return (dx,dy,dz)
# Minimal GLB writer, with sparse morph deltas to avoid storing millions of zeros.
blob=bytearray();views=[];accessors=[]
def view(data,target=None):
 while len(blob)%4:blob.append(0)
 idx=len(views);views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data),**({'target':target} if target else {})});blob.extend(data);return idx
def acc(values,kind,component=5126,target=None,bounds=False):
 flat=[v for row in values for v in (row if isinstance(row,(tuple,list)) else [row])];fmt={5126:'f',5123:'H',5125:'I'}[component];v=view(struct.pack('<'+fmt*len(flat),*flat),target)
 a={'bufferView':v,'componentType':component,'count':len(values),'type':kind}
 if bounds:a.update(min=[min(p[i] for p in values) for i in range(len(values[0]))],max=[max(p[i] for p in values) for i in range(len(values[0]))])
 accessors.append(a);return len(accessors)-1
normals=[]
for p,f in zip(positions,features):
 x,y,z=p;y-=1.67
 if f=='surface':
  normals.append(surface_normals[len(normals)])
 else:normals.append((0,0,1))
attrs={'POSITION':acc(positions,'VEC3',target=34962,bounds=True),'TEXCOORD_0':acc(uv,'VEC2',target=34962),'COLOR_0':acc([tuple(c*sin(pi*uv[i][0])**1.2 for c in (.13,.20,.24)) if f.startswith('iris') else (.18,.28,.34) if f=='wisp' else (1.,1.,1.) for i,f in enumerate(features)],'VEC3',target=34962),'NORMAL':acc(normals,'VEC3',target=34962)}
surfaceidx=acc(indices[:surface_index_count],'SCALAR',5125,34963)
coreidx=acc(core_indices,'SCALAR',5125,34963)
idxacc=acc(indices[surface_index_count:],'SCALAR',5125,34963)
# Anatomical skeleton, generated independently from measurements and named adapter contract.
bones={'Hips':(0,1,0),'Spine':(0,1.15,0),'Spine1':(0,1.3,0),'Spine2':(0,1.43,0),'Neck':(0,1.54,0),'Head':(0,1.67,0)}
parents={'Hips':'Armature','Spine':'Hips','Spine1':'Spine','Spine2':'Spine1','Neck':'Spine2','Head':'Neck'}
for side,sign in [('Left',1),('Right',-1)]:
 for part,pos,parent in [('Eye',(.045,1.704,.067),'Head'),('Shoulder',(.10,1.43,0),'Spine2'),('Arm',(.18,1.43,0),side+'Shoulder'),('ForeArm',(.38,1.43,0),side+'Arm'),('Hand',(.56,1.43,0),side+'ForeArm'),('UpLeg',(.08,.95,0),'Hips'),('Leg',(.08,.52,0),side+'UpLeg'),('Foot',(.08,.08,0),side+'Leg'),('ToeBase',(.08,.02,.1),side+'Foot')]:
  name=side+part;bones[name]=(pos[0]*sign,pos[1],pos[2]);parents[name]=parent
 for f,fo in [('Thumb',-.03),('Index',-.015),('Middle',0),('Ring',.015),('Pinky',.03)]:
  for n in range(1,4):
   name=f'{side}Hand{f}{n}';bones[name]=(sign*(.56+n*.025),1.43,fo);parents[name]=side+'Hand' if n==1 else f'{side}Hand{f}{n-1}'
names=['Armature']+list(bones);nodeidx={name:i for i,name in enumerate(names)}
nodes=[{'name':'Armature','children':[]}]
for name,pos in bones.items():
 parent=parents[name];pp=bones.get(parent,(0,0,0));nodes.append({'name':name,'translation':[pos[i]-pp[i] for i in range(3)],'children':[]});nodes[nodeidx[parent]]['children'].append(nodeidx[name])
joints=list(range(1,len(nodes)));headjoint=joints.index(nodeidx['Head'])
attrs['JOINTS_0']=acc([(headjoint,0,0,0)]*len(positions),'VEC4',5123,34962)
attrs['WEIGHTS_0']=acc([(1.,0.,0.,0.)]*len(positions),'VEC4',target=34962)
inverses=[]
for name in bones:
 x,y,z=bones[name];inverses.append((1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1))
ibm=acc(inverses,'MAT4')
targets=[]
for morph in MORPHS:
 changed=[];deltas=[]
 for i,(p,f) in enumerate(zip(positions,features)):
  d=delta(morph,p,f)
  if max(map(abs,d))>1e-5:changed.append(i);deltas.append(d)
 a={'componentType':5126,'count':len(positions),'type':'VEC3','min':[min([0]+[d[k] for d in deltas]) for k in range(3)],'max':[max([0]+[d[k] for d in deltas]) for k in range(3)]}
 if changed:a['sparse']={'count':len(changed),'indices':{'bufferView':view(struct.pack('<'+'I'*len(changed),*changed)),'componentType':5125},'values':{'bufferView':view(struct.pack('<'+'f'*(len(deltas)*3),*[v for d in deltas for v in d]))}}
 else:
  # Valid sparse zero accessor: one zero entry, no visual effect for unused tongue shape.
  a['sparse']={'count':1,'indices':{'bufferView':view(struct.pack('<I',0)),'componentType':5125},'values':{'bufferView':view(struct.pack('<fff',0,0,0))}}
 accessors.append(a);targets.append({'POSITION':len(accessors)-1})
meshnode=len(nodes);nodes.append({'name':'QuantumFilaments','mesh':0});nodes[0]['children'].append(meshnode)
doc={'asset':{'version':'2.0','generator':'Quantum Face generator; anatomical base MakeHuman CC0-1.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'skins':[{'joints':joints,'inverseBindMatrices':ibm,'skeleton':1}],'meshes':[{'name':'QuantumFace','extras':{'targetNames':MORPHS},'weights':[0]*len(MORPHS),'primitives':[
 {'attributes':attrs,'indices':surfaceidx,'material':0,'targets':targets},
 {'attributes':attrs,'indices':idxacc,'material':1,'targets':targets}]}],
 'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':[0,.6,1,.8],'metallicFactor':0,'roughnessFactor':1},'emissiveFactor':[0,.4,.8],'alphaMode':'BLEND','doubleSided':True} for name in ['FilamentSurface','FilamentContours']],
 'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':accessors}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);blob+=b'\0'*((-len(blob))%4)
body=struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
(OUT/'quantum-face.glb').write_bytes(struct.pack('<III',0x46546c67,2,12+len(body))+body)
manifest={'formatVersion':1,'id':'quantum-face','name':'Квантовое лицо · художественный прототип','model':'quantum-face.glb','body':'M','cameraView':'head','appearance':{'type':'filaments','style':'woven','color':'#009fe8','opacity':.52,'brightness':1.6,'speed':.7,'amplitude':.00035},'defaults':{'mood':'neutral'}}
(OUT/'profile.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'vertices':len(positions),'triangles':len(indices)//3,'morphs':len(MORPHS),'bytes':12+len(body)}))
