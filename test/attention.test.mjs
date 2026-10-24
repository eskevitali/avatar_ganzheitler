import assert from 'node:assert/strict';
import {attentionOf,createAttentionMotion} from '../public/attention.mjs';
assert.throws(()=>attentionOf({headYawDegrees:30}));assert.throws(()=>attentionOf({intervalMinMs:6000,intervalMaxMs:3000}));
let calls=0,seed=17;const rng=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const motion=createAttentionMotion({},rng);let maxStep=0,last=0,compensated=0;
for(let i=0;i<3600;i++){
 const m=motion.step(1/60,i<1800);
 assert.ok(Math.abs(m.yaw)<=2.8*Math.PI/180+.0001);assert.ok(Math.abs(m.pitch)<=1.1*Math.PI/180+.0001);assert.ok(Math.abs(m.eyeYaw)<=2.2*Math.PI/180+.0001);
 maxStep=Math.max(maxStep,Math.abs(m.yaw-last));last=m.yaw;
 if(Math.abs(m.yaw)>.015&&Math.sign(m.eyeYaw)===-Math.sign(m.yaw))compensated++;
}
assert.ok(calls<200,'random targets must not be generated every frame');assert.ok(maxStep<.0015,'no abrupt head jumps');assert.ok(compensated>100,'eyes compensate head yaw toward listener');
console.log('Bounded, smooth, nonperiodic attention and listener compensation verified');

const visible=createAttentionMotion({},()=>.85);visible.setIntensity(3,0);let m;
for(let i=0;i<600;i++)m=visible.step(1/60,false);
assert.ok(Math.abs(m.yaw)>3*Math.PI/180,'high head setting visible in idle');assert.ok(Math.abs(m.eyeYaw)<1e-8,'eyes independently off');
visible.setIntensity(0,3);for(let i=0;i<600;i++)m=visible.step(1/60,false);
assert.ok(Math.abs(m.yaw)<1e-6,'zero head returns to neutral');assert.ok(Math.abs(m.eyeYaw)>Math.PI/180,'eyes independently visible without head motion');
visible.setIntensity(0,0);for(let i=0;i<600;i++)m=visible.step(1/60,false);
assert.ok(Math.abs(m.eyeYaw)<1e-6&&Math.abs(m.yaw)<1e-6,'both zero smoothly return to neutral');
