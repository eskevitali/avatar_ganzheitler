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
let maxHead=0;for(let i=0;i<1800;i++){m=visible.step(1/60,false);maxHead=Math.max(maxHead,Math.abs(m.yaw));}
assert.ok(maxHead>3*Math.PI/180,'high head setting visible in idle');assert.ok(Math.abs(m.eyeYaw)<1e-8,'eyes independently off');
visible.setIntensity(0,3);let maxEye=0;for(let i=0;i<1800;i++){m=visible.step(1/60,false);if(i>600)maxEye=Math.max(maxEye,Math.abs(m.eyeYaw));}
assert.ok(Math.abs(m.yaw)<1e-6,'zero head returns to neutral');assert.ok(maxEye>Math.PI/180,'eyes independently visible without head motion');
visible.setIntensity(0,0);for(let i=0;i<600;i++)m=visible.step(1/60,false);
assert.ok(Math.abs(m.eyeYaw)<1e-6&&Math.abs(m.yaw)<1e-6,'both zero smoothly return to neutral');

// Both axes keep moving across idle/speech boundaries; spline nodes are not holds.
const generator=()=>{let seed=431;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};};
const continuous=createAttentionMotion({},generator()),idleOnly=createAttentionMotion({},generator());
let flat={yaw:0,pitch:0},longest={yaw:0,pitch:0},previous=null,maxAccelerationStep=0,previousVelocity=null,previousAcceleration=null;
const ranges={yaw:[Infinity,-Infinity],pitch:[Infinity,-Infinity]};
for(let i=0;i<14400;i++){
 const current=continuous.step(1/120,i>3600&&i<7200),idle=idleOnly.step(1/120,false);
 assert.deepEqual(current,idle,'speech must not reset or freeze the head trajectory');
 for(const axis of ['yaw','pitch']){ranges[axis][0]=Math.min(ranges[axis][0],current[axis]);ranges[axis][1]=Math.max(ranges[axis][1],current[axis]);}
 if(previous){
  const v={yaw:(current.yaw-previous.yaw)*120,pitch:(current.pitch-previous.pitch)*120};
  for(const axis of ['yaw','pitch'])if(i>240){flat[axis]=Math.abs(v[axis])<1e-6?flat[axis]+1:0;longest[axis]=Math.max(longest[axis],flat[axis]);}
  if(previousVelocity){const acceleration={yaw:(v.yaw-previousVelocity.yaw)*120,pitch:(v.pitch-previousVelocity.pitch)*120};if(previousAcceleration&&i>240)maxAccelerationStep=Math.max(maxAccelerationStep,Math.abs(acceleration.yaw-previousAcceleration.yaw),Math.abs(acceleration.pitch-previousAcceleration.pitch));previousAcceleration=acceleration;}
  previousVelocity=v;
 }
 previous=current;
}
assert.ok(ranges.yaw[1]-ranges.yaw[0]>.02&&ranges.pitch[1]-ranges.pitch[0]>.01,'both axes have visible movement');
assert.ok(longest.yaw<30&&longest.pitch<30,'no held-angle plateau, excluding initial fade in');
assert.ok(maxAccelerationStep<.003,'no acceleration jumps at spline knots');
console.log(JSON.stringify({ranges_rad:ranges,longest_near_zero_velocity_seconds:{yaw:longest.yaw/120,pitch:longest.pitch/120},max_acceleration_step:maxAccelerationStep}));

// Foreground clean view and throttled background pult use the same clock.
let wall=10000;const foreground=createAttentionMotion({},Math.random,{seed:'same-channel',clock:()=>wall}),background=createAttentionMotion({},Math.random,{seed:'same-channel',clock:()=>wall});
let f,b;
for(let i=0;i<600;i++){wall+=1/60;f=foreground.step(1/60,false);if(i%60===59)b=background.step(1,false);}
assert.ok(Math.abs(f.yaw-b.yaw)<1e-8&&Math.abs(f.pitch-b.pitch)<1e-8,'background RAF throttling cannot slow clean trajectory');
