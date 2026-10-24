// Profile-local expression weights. Neutral and zero strength have no expression.
// No nose, jaw, viseme, blink or eye-look channels are part of these presets.
export const emotionPresets={
 neutral:{},
 happy:{mouthSmileLeft:.72,mouthSmileRight:.72,mouthDimpleLeft:.20,mouthDimpleRight:.20,cheekSquintLeft:.22,cheekSquintRight:.22,browOuterUpLeft:.15,browOuterUpRight:.15},
 sad:{mouthFrownLeft:.90,mouthFrownRight:.90,browInnerUp:.80,browOuterUpLeft:.10,browOuterUpRight:.10,eyeSquintLeft:.15,eyeSquintRight:.15},
 fear:{browInnerUp:.80,browOuterUpLeft:.50,browOuterUpRight:.50,eyeWideLeft:.85,eyeWideRight:.85,mouthStretchLeft:.28,mouthStretchRight:.28},
 angry:{browDownLeft:.65,browDownRight:.65,eyeSquintLeft:.20,eyeSquintRight:.20,mouthPressLeft:.45,mouthPressRight:.45,mouthFrownLeft:.28,mouthFrownRight:.28},
};
export const emotionKeys=[...new Set(Object.values(emotionPresets).flatMap(Object.keys))];
export function createEmotionLayer(mood='neutral',strength=1){
 let selected=Object.hasOwn(emotionPresets,mood)?mood:'neutral',intensity=strength;
 const values=Object.fromEntries(emotionKeys.map(k=>[k,0]));
 return {set(mood,level=intensity){selected=Object.hasOwn(emotionPresets,mood)?mood:'neutral';intensity=Math.max(0,Math.min(2,Number(level)||0));},step(dt,speaking,blink){
  const k=1-Math.exp(-Math.max(0,dt)*5),out={};
  for(const key of emotionKeys){const goal=Math.min(1,(emotionPresets[selected][key]||0)*intensity);values[key]+=(goal-values[key])*k;
   // Speech owns lip articulation; full blink owns the lid aperture.
   const mouth=key.startsWith('mouth')?(speaking?.4:1):1;
   const lids=key.startsWith('eye')||key.startsWith('cheek')?(1-Math.min(1,Math.max(0,blink)))**2:1;
   out[key]=values[key]*mouth*lids;
  }
  return out;
 },get mood(){return selected;},get strength(){return intensity;}};
}
