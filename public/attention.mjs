// Small, nonperiodic attention to a virtual listener in front of the camera.
export function attentionOf(raw={}) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('Неверные параметры внимания');
  const out={};
  for(const [key,fallback,min,max]of [['headYawDegrees',2.8,0,5],['headPitchDegrees',1.1,0,2],['eyeDegrees',2.2,0,3],['compensation',.65,0,1],['intervalMinMs',2600,1800,10000],['intervalMaxMs',6500,1800,12000]]){
    const v=raw[key]??fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`attention.${key}: вне диапазона`);out[key]=v;
  }
  if(out.intervalMaxMs<out.intervalMinMs)throw new Error('Неверный интервал внимания');return out;
}
export function createAttentionMotion(raw,random=Math.random){
  const c=attentionOf(raw),rad=Math.PI/180;let at=0,next=0,nextEye=0,wasSpeaking=false,centerUntil=0;
  const a={yaw:0,pitch:0,eyeYaw:0,eyePitch:0},vel={...a};let yawTarget=0,pitchTarget=0,eyeX=0,eyeY=0;
  const sample=(lo,hi)=>lo+(hi-lo)*random();
  const damp=(key,target,dt,w)=>{vel[key]+=((target-a[key])*w*w-2*w*vel[key])*dt;a[key]+=vel[key]*dt;};
  return {step(dt,speaking){
    dt=Math.min(.05,Math.max(0,dt));at+=dt*1000;
    if(wasSpeaking&&!speaking){centerUntil=at+1800;next=centerUntil;yawTarget=pitchTarget=0;}
    wasSpeaking=speaking;
    if(at>=next&&at>=centerUntil){const scale=speaking?1:.5;yawTarget=sample(-1,1)*c.headYawDegrees*rad*scale;pitchTarget=sample(-1,1)*c.headPitchDegrees*rad*scale;next=at+sample(c.intervalMinMs,c.intervalMaxMs);}
    if(at>=nextEye){eyeX=sample(-.004,.004);eyeY=sample(-.002,.002);nextEye=at+sample(2600,5500);}
    damp('yaw',yawTarget,dt,2);damp('pitch',pitchTarget,dt,2);
    const limit=c.eyeDegrees*rad,clamp=v=>Math.min(limit,Math.max(-limit,v));
    damp('eyeYaw',clamp(-a.yaw*c.compensation+eyeX),dt,3.8);damp('eyePitch',clamp(-a.pitch*c.compensation+eyeY),dt,3.8);
    return {...a};
  }};
}
