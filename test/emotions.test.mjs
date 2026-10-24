import assert from 'node:assert/strict';
import {createEmotionLayer,emotionKeys} from '../public/emotions.mjs';
import {visualsOf} from '../public/profiles.mjs';
assert.throws(()=>visualsOf({emotionStrength:3}));
for(const key of emotionKeys)assert.ok(!/^(nose|jaw|viseme|eyeBlink|eyeLook)/.test(key));
for(const mood of ['happy','sad','fear','angry']){
 const layer=createEmotionLayer(mood,1);let medium;
 for(let i=0;i<120;i++)medium=layer.step(1/60,false,0);
 assert.ok(Math.max(...Object.values(medium))>.5,'readable expression');
 layer.set(mood,2);const first=layer.step(1/60,false,0);assert.ok(Math.max(...Object.values(first))<=1);
 let full;for(let i=0;i<120;i++)full=layer.step(1/60,false,0);assert.ok(Object.keys(full).some(k=>full[k]>medium[k]+.05));
 const blinking=layer.step(1/60,false,1);for(const key of emotionKeys.filter(k=>/^(eye|cheek)/.test(k)))assert.equal(blinking[key],0,'full blink owns lid closure');
 layer.set(mood,0);let zero;for(let i=0;i<240;i++)zero=layer.step(1/60,false,0);assert.ok(Math.max(...Object.values(zero))<1e-8,'zero is neutral');
 layer.set('neutral',2);assert.ok(Math.max(...Object.values(layer.step(1,false,0)))<1e-8);
}
console.log('Expression strength/zero/neutral, blink priority and excluded nose/jaw/visemes verified');
