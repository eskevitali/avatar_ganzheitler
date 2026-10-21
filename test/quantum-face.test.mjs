import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {manifestOf, settingsOf, visualsOf} from '../public/profiles.mjs';
import {validateGlb, saveSettings, readSettings} from '../profile-store.mjs';
const bytes=readFileSync(new URL('../assets/quantum-face/quantum-face.glb',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../assets/quantum-face/profile.json',import.meta.url)));
test('portable face is a self-contained, bounded filament profile with no opaque shell',()=>{
 const profile=manifestOf(manifest);assert.equal(profile.appearance.style,'woven');
 const gltf=validateGlb(bytes);
 assert.equal(gltf.meshes.length,1);
 assert.deepEqual(gltf.materials.map(m=>m.name),['FilamentSurface','FilamentContours']);
 const pos=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
 assert.ok(pos.min[1]>1.48 && pos.max[1]<1.90,'visible vertices are confined to head region');
 assert.ok(bytes.length<4_000_000,'package stays lightweight');
 const meshNodes=gltf.nodes.filter(n=>n.mesh!==undefined);assert.equal(meshNodes.length,1);
 for(const name of ['viseme_PP','viseme_aa','viseme_O','viseme_I','jawOpen','eyeBlinkLeft','eyeBlinkRight','browInnerUp','mouthSmileLeft']){
  const index=gltf.meshes[0].extras.targetNames.indexOf(name);assert.ok(index>=0,name);
  const target=gltf.accessors[gltf.meshes[0].primitives[0].targets[index].POSITION];
  assert.ok(target.sparse.count>1,`${name} has real deformations`);
  assert.ok(target.min.some(n=>n<0)||target.max.some(n=>n>0),`${name} isn't a placeholder`);
 }
});
test('appearance only accepts renderer-owned effects and finite bounded parameters',()=>{
 for(const patch of [{type:'javascript'}, {color:'url(x)'},{style:'custom-shader'},{opacity:2},{speed:-1},{amplitude:1},{brightness:Infinity}])assert.throws(()=>manifestOf({...manifest,appearance:{...manifest.appearance,...patch}}));
 const result=manifestOf({...manifest,appearance:{...manifest.appearance,code:'not executed'}});
 assert.equal(result.appearance.code,undefined);
 for(const patch of [{opacity:0},{brightness:99},{speed:NaN}])assert.throws(()=>visualsOf(patch));
});
test('visual tuning persists with facial settings and leaves another profile independent',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'face-settings-'));
 try {
  const file=path.join(dir,'profiles.json');
  await saveSettings(file,'training',{mood:'happy'});
  const before=(await readSettings(file)).training;
  await saveSettings(file,'quantum-face',{mood:'sad',visuals:{opacity:.31,brightness:1.8,speed:.5},lips:{PP:{jawOpen:.14}}});
  const after=await readSettings(file);assert.deepEqual(after.training,before);
  assert.deepEqual(settingsOf(after['quantum-face']).visuals,{opacity:.31,brightness:1.8,speed:.5});
  assert.equal(after['quantum-face'].lips.PP.jawOpen,.14);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
