"""Give every installed user-mask revision a content-addressed model URL."""
import pathlib,hashlib,json,shutil,os
ROOT=pathlib.Path(__file__).resolve().parents[1];source=ROOT/'assets/user-mask';model=source/'user-mask.glb';data=model.read_bytes();digest=hashlib.sha256(data).hexdigest();name='user-mask-'+digest[:12]+'.glb'
(source/name).write_bytes(data);manifest=json.loads((source/'profile.json').read_text());manifest['model']=name
(source/'profile.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
installed=ROOT/'public/profiles/user-mask';installed.mkdir(exist_ok=True,parents=True)
shutil.copy2(source/name,installed/name);temp=installed/'profile.json.new';temp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');os.replace(temp,installed/'profile.json')
revision={'id':'user-mask','model':name,'sha256':digest,'bytes':len(data),'accepted_source':'source/user-accepted-2026-10-23.blend','appearance_status':'user accepted browser preview, 2026-10-23'}
(source/'revision.json').write_text(json.dumps(revision,ensure_ascii=False,indent=2)+'\n');print(json.dumps(revision,ensure_ascii=False))
