// Small, nonperiodic attention to a virtual listener in front of the camera.
export function attentionOf(raw={}) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('Неверные параметры внимания');
  const out={};
  for(const [key,fallback,min,max]of [['headYawDegrees',2.8,0,5],['headPitchDegrees',1.1,0,2],['eyeDegrees',2.2,0,3],['compensation',.65,0,1],['intervalMinMs',2600,1800,10000],['intervalMaxMs',6500,1800,12000]]){
    const v=raw[key]??fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`attention.${key}: вне диапазона`);out[key]=v;
  }
  if(out.intervalMaxMs<out.intervalMinMs)throw new Error('Неверный интервал внимания');return out;
}
// Random-access cubic B-spline noise is C2 across every knot. A shared seed
// and wall clock let the clean view move independently of background-tab RAF.
function hash(n){n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return(n^(n>>>16))>>>0;}
function seedOf(value){let n=2166136261;for(const ch of String(value))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
function noiseBand(span,seed){return time=>{
 const x=time/span,i=Math.floor(x),t=x-i,t2=t*t,t3=t2*t,q=[];
 for(let j=0;j<4;j++)q.push(hash((i+j)^seed)/2147483647.5-1);
 return ((1-3*t+3*t2-t3)*q[0]+(4-6*t2+3*t3)*q[1]+(1+3*t+3*t2-3*t3)*q[2]+t3*q[3])/6;
};}
export function createAttentionMotion(raw,random=Math.random,options={}){
 const c=attentionOf(raw),rad=Math.PI/180,span=(c.intervalMinMs+c.intervalMaxMs)/2000;
 const seed=options.seed===undefined?Math.floor(random()*4294967296):seedOf(options.seed);
 const band=(speed,salt)=>noiseBand(span*speed,seed^salt);
 const yawSlow=band(1,8191),yawFast=band(.53,127),pitchSlow=band(1.17,32749),pitchFast=band(.61,65521),eyeX=band(.72,524287),eyeY=band(.91,131071);
 let time=0,headIntensity=1,eyeIntensity=1;const gains={head:[0,0,0],eyes:[0,0,0]};
 const advanceGain=(values,target,dt)=>{const k=1-Math.exp(-dt*7);for(let i=0;i<3;i++){values[i]+=(target-values[i])*k;target=values[i];}return values[2];};
 return {setIntensity(head,eyes){headIntensity=Math.max(0,Math.min(3,head));eyeIntensity=Math.max(0,Math.min(3,eyes));},step(dt,_speaking){
   dt=Math.max(0,Math.min(10,dt));time+=dt;
   let remaining=dt;
   while(remaining>1e-9){const h=Math.min(1/120,remaining);remaining-=h;advanceGain(gains.head,headIntensity,h);advanceGain(gains.eyes,eyeIntensity,h);}
   const t=options.clock?options.clock():time,h=gains.head[2],e=gains.eyes[2];
   const yaw=(.75*yawSlow(t)+.25*yawFast(t))*c.headYawDegrees*rad*h;
   const pitch=(.75*pitchSlow(t)+.25*pitchFast(t))*c.headPitchDegrees*rad*h;
   const limit=Math.min(6,c.eyeDegrees*e)*rad,clamp=v=>Math.min(limit,Math.max(-limit,v));
   return {yaw,pitch,eyeYaw:clamp((-yaw*c.compensation+eyeX(t)*.65*c.eyeDegrees*rad)*e),eyePitch:clamp((-pitch*c.compensation+eyeY(t)*.25*c.eyeDegrees*rad)*e)};
 }};
}
