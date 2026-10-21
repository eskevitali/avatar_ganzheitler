"""Build a front-only 3D mask, fitted to reference 002. No raster image editing.
The reference defines landmarks, silhouette and facial surface colors.
Its texture is bound to the sculpted geometry, never a separate image plane.
Anatomical depth is sampled from the CC0 head.
Lips/eyelids use matching geometry and UV landmarks, not a screen overlay.
"""
import json, math, struct, pathlib, collections, random
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/reference-mask-002';OUT.mkdir(parents=True,exist_ok=True)
reference=OUT/'reference.png'
landmarks=json.loads((OUT/'landmarks.json').read_text())
MOUTH_U=landmarks['mouthCenterPixels'][0]/landmarks['imageWidth']
MOUTH_V=landmarks['mouthCenterPixels'][1]/landmarks['imageHeight']
MOUTH_HALF=landmarks['mouthHalfWidthPixels']/landmarks['imageWidth']
SEAM=[(x/landmarks['imageWidth'],y/landmarks['imageHeight'])for x,y in landmarks['mouthSeamPixels']]
old=(ROOT/'assets/quantum-face/quantum-face.glb').read_bytes()
rig=json.loads(old[20:20+struct.unpack_from('<I',old,12)[0]])
MORPHS=rig['meshes'][0]['extras']['targetNames']
# Anatomical landmark registration. UV v is measured down from the PNG's top.
YMAP=[(6.15,.90),(6.23,.855),(6.60,.651),(6.67,.620),(6.73,.586),(6.91,.508),(7.15,.441),(7.295,.391),(7.4075,.365),(7.53,.310),(7.90,.205),(8.49,.075)]
def interp(value,anchors):
 for (a,b),(c,d) in zip(anchors,anchors[1:]):
  if a<=value<=c:return b+(d-b)*(value-a)/(c-a)
 return anchors[0][1] if value<anchors[0][0] else anchors[-1][1]
def image_uv(p):return (.5355+p[0]*.337,interp(p[1],YMAP))
def physical(u,v,z):return ((u-.5355)*.45,1.67+(.50-v)*.335,z)
# New reference-guided feminine sculpt. No previous visible head is reused.
# Broad cheek volumes, short rounded lower face and soft full lips.
WIDTH=[(.08,.055),(.13,.145),(.22,.205),(.34,.235),(.45,.240),(.54,.224),(.64,.199),(.73,.164),(.82,.108),(.88,.018)]
def sculpt_width(v):return interp(v,WIDTH)
def g(u,v,cx,cy,sx,sy):return math.exp(-(((u-cx)/sx)**2+((v-cy)/sy)**2))
def depth(u,v):
 dx=u-.5355;w=max(.01,sculpt_width(v));z=.022+.041*math.sqrt(max(0,1-(dx/w)**2))
 z+=.008*g(u,v,.5355,.24,.18,.14)
 z+=.012*(g(u,v,.405,.52,.080,.075)+g(u,v,.666,.52,.080,.075))
 z-=.010*(g(u,v,.429,.391,.060,.035)+g(u,v,.642,.391,.060,.035))
 z+=.006*(g(u,v,.429,.335,.075,.023)+g(u,v,.642,.335,.075,.023))
 z+=.008*g(u,v,.5355,.447,.020,.078)+.010*g(u,v,.5355,.509,.029,.025)
 z+=.0055*(g(u,v,.510,.525,.018,.014)+g(u,v,.561,.525,.018,.014))
 z-=.0025*(g(u,v,.517,.536,.009,.005)+g(u,v,.554,.536,.009,.005))
 z+=.010*g(u,v,MOUTH_U,.565,.069,.014)+.012*g(u,v,MOUTH_U,.610,.065,.017)
 z-=.003*g(u,v,MOUTH_U,MOUTH_V,.062,.003)
 z+=.010*g(u,v,.5355,.786,.085,.060)
 return z
positions=[];uvs=[];features=[];meta=[];groups=[[],[],[],[]];vertex_cache={}
def vertex(u,v,z,feature='face',extra=0):
 key=(round(u,7),round(v,7),round(z,7),feature,round(extra,7))
 if key in vertex_cache:return vertex_cache[key]
 i=len(positions);vertex_cache[key]=i;positions.append(physical(u,v,z));uvs.append((u,v));features.append(feature);meta.append(extra);return i
def tri(a,b,c,group=0):groups[group].extend((a,b,c))
def eye_box(u,v):return any(abs(u-c)<.063 and .343<v<.441 for c in [.429,.642])
def mouth_box(u,v):return .445<u<.626 and .548<v<.703
# Explicit front-only sculpted surface; no occiput, skull shell or neck.
face_rows=[]
for j in range(97):
 v=.08+.80*j/96;w=sculpt_width(v);row=[]
 for i in range(81):
  u=.5355-w+2*w*i/80;row.append(vertex(u,v,depth(u,v)))
 face_rows.append(row)
for j in range(96):
 for i in range(80):
  ids=[face_rows[j][i],face_rows[j][i+1],face_rows[j+1][i],face_rows[j+1][i+1]]
  u=sum(uvs[k][0]for k in ids)/4;v=sum(uvs[k][1]for k in ids)/4
  if eye_box(u,v)or mouth_box(u,v):continue
  a,b,c,d=ids;tri(a,c,b);tri(b,c,d)
# Rectangular patch grids share exact reference landmarks at neutral pose.
def patch(n,m,at,feature,group=0):
 rows=[]
 for j in range(m+1):
  row=[]
  for i in range(n+1):
   u,v,z,extra=at(i/n,j/m);row.append(vertex(u,v,z,feature,extra))
  rows.append(row)
 for j in range(m):
  for i in range(n):
   a,b,c,d=rows[j][i],rows[j][i+1],rows[j+1][i],rows[j+1][i+1]
   tri(a,c,b,group);tri(b,c,d,group)
def seam(u):return interp(u,SEAM)
# Lip seams are duplicated: upper and lower lips can physically separate.
for upper in [True,False]:
 def at(s,t,upper=upper):
  u=.438+.195*s;mid=seam(u);v=(.538+(mid-.538)*t) if upper else(mid+(.713-mid)*t)
  return u,v,depth(u,v)+.00045,(t if upper else 1-t)
 patch(48,18,at,'upperLip'if upper else'lowerLip')
# A recessed oral cavity opens with those same lip seams, never a floating hole.
def oral(s,t):
 u=MOUTH_U-MOUTH_HALF+MOUTH_HALF*2*s;v=seam(u)+.00012*(2*t-1);z=depth(u,v)-.008-.012*math.sin(math.pi*s)*math.sin(math.pi*t)
 return u,v,z,t
patch(36,10,oral,'mouthInterior',2)
# Eyeballs occupy real recessed sockets. Eyelid skin covers them during blinks.
for side,cx in [('Right',.429),('Left',.642)]:
 def boundaries(s):
  shape=math.sin(math.pi*s)**.70
  return .391-.023*shape,.391+.018*shape
 def eyeball(s,t,cx=cx):
  u=cx-.057+.114*s;a,b=boundaries(s);v=a+(b-a)*t
  z=depth(cx,.391)+.001+.004*math.sin(math.pi*s)*math.sin(math.pi*t)
  return u,v,z,0
 patch(40,12,eyeball,'eye'+side,1)
 for upper in [True,False]:
  def lid(s,t,upper=upper,cx=cx):
   u=cx-.070+.140*s
   a,b=boundaries(max(0,min(1,(u-(cx-.057))/.114)))
   edge=a if upper else b
   v=.332+(edge-.332)*t if upper else edge+(.452-edge)*t
   return u,v,depth(u,v)+.0018,(t if upper else 1-t)
  patch(40,12,lid,('upperLid'if upper else'lowerLid')+side)
# Original spatial neural strands: no image plane or reference alpha cutout.
rng=random.Random(2002)
for strand in range(80):
 side=-1 if strand%2 else 1
 angle=rng.uniform(-1.10,1.10)
 # Frontal temples/crown only; no closed ring or rear shell.
 start_u=.5355+side*(.19+.05*math.sin(angle))
 start_v=.46+.31*math.sin(angle)
 if strand%3==0:start_u=rng.uniform(.36,.71);start_v=rng.uniform(.10,.18)
 points=[];n=32
 for i in range(n):
  t=i/(n-1);flow=math.sin(t*math.pi)
  u=start_u+side*(.10*t+.035*math.sin(t*5+strand)*flow)
  v=start_v+.065*math.sin(t*4+strand)*flow+(.035 if strand%3 else-.09)*t
  z=.028+.022*math.sin(t*math.pi+strand*.43)+.009*math.sin(t*5+strand)
  points.append((u,v,z))
 rows=[]
 for i,(u,v,z)in enumerate(points):
  before=points[max(0,i-1)];after=points[min(n-1,i+1)];dx=after[0]-before[0];dy=after[1]-before[1];length=max(1e-8,math.hypot(dx,dy));w=.00065*(1-i/(n-1)*.70)
  rows.append([vertex(u-sign*dy/length*w,v+sign*dx/length*w,z,'strand',i/(n-1))for sign in [-1,1]])
 for i in range(n-1):
  a,b=rows[i];c,d=rows[i+1];tri(a,c,b,3);tri(b,c,d,3)
# All visible components use the same facial landmark space and 57 morph channels.
def gauss(u,v,cx,cy,sx,sy):return math.exp(-(((u-cx)/sx)**2+((v-cy)/sy)**2))
def delta(name,p,uv,feature,extra):
 u,v=uv;x,y,z=p;dx=dy=dz=0.
 if v<.545 and (name.startswith(('mouth','jaw','viseme_'))):return (0.,0.,0.)
 side='Left'if not name.endswith('Right')else'Right';cx=.642 if side=='Left'else .429
 mouth=gauss(u,v,MOUTH_U,.605,.100,.072);lower=1/(1+math.exp(-(v-seam(u))*180))
 edge=max(0,1-((u-MOUTH_U)/MOUTH_HALF)**2)
 if name in ['jawOpen','mouthOpen','viseme_aa']:
  amount={'jawOpen':.016,'mouthOpen':.003,'viseme_aa':.006}[name]
  if feature=='mouthInterior':dy-=amount*edge*extra
  elif feature=='lowerLip':dy-=amount*edge*extra
  elif feature=='upperLip':dy+=amount*.10*edge*extra
  else:dy-=amount*mouth*lower*.38
  dz-=amount*.12*mouth*lower
 if name in ['mouthClose','viseme_PP']:
  dy+=(.003 if name=='mouthClose'else .002)*mouth*(1 if v>seam(u) else-.30)
 if name in ['viseme_O','mouthFunnel','mouthPucker']:
  dx-=(x)*mouth*({'viseme_O':.12,'mouthFunnel':.10,'mouthPucker':.07}[name]);dz+=.0025*mouth
 if name=='viseme_I':dx+=x*mouth*.16
 if any(k in name for k in ['mouthSmile','mouthStretch','mouthFrown']):
  sign=1 if side=='Left'else-1;corner=gauss(u,v,MOUTH_U+sign*.065,seam(MOUTH_U+sign*.065),.042,.040)
  dy+=(-.005 if 'Frown'in name else .005)*corner;dx+=sign*.002*corner
 if name in ['mouthLeft','jawLeft','mouthRight','jawRight']:dx+=(.003 if name.endswith('Left')else-.003)*mouth
 if name=='jawForward':dz+=.004*mouth
 if name.startswith(('eyeBlink','eyeSquint')):
  amount=1 if 'Blink'in name else .5
  if feature in ['upperLid'+side,'lowerLid'+side]:dy-=(.391-v)*.335*extra*amount
 if name.startswith('eyeWide') and feature in ['upperLid'+side,'lowerLid'+side]:dy+=(.391-v)*.335*extra*.25
 if name.startswith('eyeLook') and feature=='eye'+side:
  if 'Up'in name:dy+=.0018
  elif 'Down'in name:dy-=.0018
  elif 'In'in name:dx+=(-1 if side=='Left'else 1)*.0018
  else:dx+=(1 if side=='Left'else-1)*.0018
 if name.startswith('brow'):
  region=gauss(u,v,.5355 if name=='browInnerUp'else cx,.317,.075,.035)
  dy+=(-.005 if 'Down'in name else .006)*region
 if name.startswith('mouthUpperUp'):dy+=.002*mouth*(1-lower)
 if name.startswith('mouthLowerDown'):dy-=.002*mouth*lower
 if name.startswith('mouthRoll'):dz-=.002*mouth
 if name.startswith('mouthShrug'):dy+=.002*mouth
 if name.startswith('mouthPress'):dz-=.001*mouth
 if name.startswith('mouthDimple'):dz-=.002*mouth
 if name.startswith('cheek'):dz+=.002*gauss(u,v,cx,.51,.08,.07)
 if name.startswith('noseSneer'):dy+=.002*gauss(u,v,cx,.50,.05,.05)
 return dx,dy,dz
# GLB serialization, including unchanged embedded texture and hidden adapter skeleton.
blob=bytearray();views=[];accessors=[]
def view(data,target=None):
 while len(blob)%4:blob.append(0)
 n=len(views);views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data),**({'target':target}if target else{})});blob.extend(data);return n
def acc(rows,kind,component=5126,target=None,bounds=False):
 flat=[a for row in rows for a in(row if isinstance(row,(list,tuple))else[row])];fmt={5126:'f',5125:'I'}[component]
 a={'bufferView':view(struct.pack('<'+fmt*len(flat),*flat),target),'componentType':component,'count':len(rows),'type':kind}
 if bounds:a.update(min=[min(p[k]for p in rows)for k in range(3)],max=[max(p[k]for p in rows)for k in range(3)])
 accessors.append(a);return len(accessors)-1
# Each primitive stores only its own vertices/morphs (no 4x GPU morph textures).
primitives=[]
for group,indices in enumerate(groups):
 used=sorted(set(indices));local={old:i for i,old in enumerate(used)}
 attrs={'POSITION':acc([positions[i]for i in used],'VEC3',target=34962,bounds=True),'TEXCOORD_0':acc([uvs[i]for i in used],'VEC2',target=34962),'COLOR_0':acc([(1,1,1,max(0,1-meta[i])**.8)if features[i]=='strand'else(1,1,1,1)for i in used],'VEC4',target=34962)}
 targets=[]
 for name in MORPHS:
  changed=[];values=[]
  for j,i in enumerate(used):
   d=delta(name,positions[i],uvs[i],features[i],meta[i])
   if max(map(abs,d))>1e-5:changed.append(j);values.append(d)
  if not changed:changed=[0];values=[(0,0,0)]
  a={'componentType':5126,'count':len(used),'type':'VEC3','min':[min(0,min(p[k]for p in values))for k in range(3)],'max':[max(0,max(p[k]for p in values))for k in range(3)],'sparse':{'count':len(changed),'indices':{'bufferView':view(struct.pack('<'+'I'*len(changed),*changed)),'componentType':5125},'values':{'bufferView':view(struct.pack('<'+'f'*len(values)*3,*[v for p in values for v in p]))}}}
  accessors.append(a);targets.append({'POSITION':len(accessors)-1})
 primitives.append({'attributes':attrs,'indices':acc([local[i]for i in indices],'SCALAR',5125,34963),'material':group,'targets':targets})
imageview=view(reference.read_bytes())
nodes=rig['nodes'];meshnode=next(n for n in nodes if 'mesh'in n);meshnode['name']='Reference002Mask'
materials=[]
for i,name in enumerate(['ReferenceMask','ReferenceEyes','MouthInterior','ReferenceStrands']):
 material={'name':name,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1]if i!=2 else [.002,.008,.016,1],'metallicFactor':0,'roughnessFactor':1},'alphaMode':'BLEND','doubleSided':True}
 if i in [0,1]:material['pbrMetallicRoughness']['baseColorTexture']={'index':0}
 materials.append(material)
doc={'asset':{'version':'2.0','generator':'Original reference-guided front-mask sculpt 002'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':[{'name':'Reference002Mask','extras':{'targetNames':MORPHS,'referenceLandmarks':{'eyeRight':[.429,.391],'eyeLeft':[.642,.391],'mouth':[MOUTH_U,MOUTH_V],'mouthSeam':SEAM},'frontMaskOnly':True},'weights':[0]*len(MORPHS),'primitives':primitives}],'materials':materials,'images':[{'bufferView':imageview,'mimeType':'image/png'}],'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':accessors}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);blob+=b'\0'*((-len(blob))%4)
body=struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
(OUT/'reference-mask.glb').write_bytes(struct.pack('<III',0x46546c67,2,12+len(body))+body)
manifest={'formatVersion':1,'id':'reference-mask-002','name':'Нейросетевая маска · 002','model':'reference-mask.glb','body':'M','cameraView':'head','appearance':{'type':'filaments','style':'reference-mask','color':'#ffffff','opacity':1,'brightness':1,'speed':.7,'amplitude':.00035,'activity':{'type':'neural-glow','strength':.4}},'defaults':{'mood':'neutral'}}
(OUT/'profile.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(OUT/'LICENSE.txt').write_text('Visible mask geometry: original procedural sculpt and filaments created for this project. No MakeHuman visible mesh is included in this profile.\nReference 002: user-provided visual guide; its bitmap is registered to the new sculpt and embedded as a surface texture. No ownership claim is assigned to the reference.\nGenerated front-mask mesh and morph implementation: project source code terms.\n')
print(json.dumps({'vertices':len(positions),'triangles':sum(map(len,groups))//3,'morphs':len(MORPHS),'bytes':12+len(body),'frontMaskOnly':True,'newVisibleSculpt':True}))
