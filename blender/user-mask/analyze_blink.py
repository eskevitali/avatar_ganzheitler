"""Read-only blink locality and eye-surface analysis, accepted neutral untouched."""
import bpy,json,pathlib,collections
ROOT=pathlib.Path('/home/violes/GPT_Project/avatar_ganzheitler/repo');m=bpy.data.objects['UserAcceptedMask'];b=m.data.shape_keys.key_blocks['Basis'];roles=m.data.attributes['mask_role'].data
report={}
for side in ['Left','Right']:
 key=m.data.shape_keys.key_blocks['eyeBlink'+side];regions=collections.defaultdict(list)
 for i,p in enumerate(b.data):
  if roles[i].value:continue
  d=key.data[i].co-p.co
  if d.length<1e-6:continue
  x,y,z=p.co
  region='bridge' if abs(x)<.022 and 1.67<z<1.73 else 'brow' if z>1.705 else 'eye_or_cheek'
  regions[region].append((i,d.length,tuple(p.co),tuple(d)))
 report[side]={name:{'count':len(rows),'max_displacement_mm':max(r[1]for r in rows)*1000,'examples':sorted(rows,key=lambda r:-r[1])[:5]}for name,rows in regions.items()}
path=ROOT/'blender/user-mask/blink-locality-before.json';path.write_text(json.dumps(report,indent=2));print(json.dumps(report))
