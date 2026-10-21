import * as THREE from 'three';
import {visualsOf} from './profiles.mjs';
// Renderer-owned, bounded material adapter. Profiles contain data, never shader source.
const noiseGLSL = `
float fhash(vec2 p) { p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float fnoise(vec2 p) {
 vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(fhash(i),fhash(i+vec2(1,0)),f.x),mix(fhash(i+vec2(0,1)),fhash(i+vec2(1,1)),f.x),f.y);
}
float strand(float field, float width) {
 float aa=max(.006,fwidth(field)*.32);
 return 1.0-smoothstep(width,width+aa,abs(field-.5));
}
`;
export function attachFilaments(doll, appearance) {
  let visual = visualsOf(appearance);
  const uniforms = {threadTime:{value:0}, threadReveal:{value:1}, threadMotion:{value:appearance.amplitude}, threadSpeed:{value:visual.speed}, threadBrightness:{value:visual.brightness}, threadOpacity:{value:visual.opacity}};
  const materials=[];
  doll.armature.traverse(mesh => {
    if(!mesh.isMesh)return;
    const previous=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const volume=previous.some(m=>m.name==='FilamentVolume');
    const surface=appearance.style==='woven' && previous.some(m=>m.name==='FilamentSurface');
    const material=new THREE.MeshBasicMaterial({color:volume ? '#00101c' : appearance.color, transparent:true, opacity:volume ? .025 : appearance.opacity, side:surface ? THREE.FrontSide : THREE.DoubleSide, depthWrite:false, blending:volume ? THREE.NormalBlending : THREE.AdditiveBlending});
    if (!volume) {
      // Optical emission: brightness and coverage are independent. Thin luminous
      // strands can remain bright without filling their transparent surroundings.
      material.blending=THREE.CustomBlending;
      material.blendSrc=THREE.OneFactor; material.blendDst=THREE.OneFactor;
      material.blendSrcAlpha=THREE.OneFactor; material.blendDstAlpha=THREE.OneMinusSrcAlphaFactor;
    }
    material.forceSinglePass=true;
    material.toneMapped=false;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const declarations='uniform float threadTime; uniform float threadReveal; uniform float threadMotion; uniform float threadSpeed; uniform float threadBrightness; uniform float threadOpacity; varying vec2 threadUV; varying vec3 threadNormal; varying vec3 threadPoint;\n';
      shader.vertexShader=declarations+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        threadUV=uv; threadPoint=position; threadNormal=normalize(normalMatrix*normal);
        float t=threadTime*threadSpeed;
        transformed.z-=${volume ? '.0015' : '0.0'};
        transformed.z+=sin(uv.x*41.0+uv.y*53.0+t)*threadMotion;
        float rotation=sin(t*.21)*.035;
        transformed.x=transformed.x*cos(rotation)+transformed.z*sin(rotation);
        transformed.x+=(1.0-threadReveal)*sin(uv.y*31.0+uv.x*11.0+t*.4)*.12;
        transformed.y+=(1.0-threadReveal)*cos(uv.y*29.0+t*.3)*.065;
      `);
      shader.fragmentShader=declarations+noiseGLSL+shader.fragmentShader;
      const field=volume ? 'diffuseColor.a*=threadReveal;' : surface?`
        float t=threadTime*threadSpeed;
        vec2 anatomical=threadUV+threadPoint.zz*vec2(1.6,.7);
        vec2 flow=vec2(fnoise(anatomical*9.0),fnoise(anatomical*11.0+4.0));
        vec2 woven=anatomical*vec2(86.0,105.0)+flow*10.0+vec2(sin(t*.13+threadUV.y*19.0),cos(t*.11+threadUV.x*15.0))*.20;
        float n=fnoise(woven), n2=fnoise(woven*.67+flow*4.0+19.0);
        float threads=max(strand(n,.006),strand(n2,.004)*.35);
        float halo=max(strand(n,.025),strand(n2,.020)*.35);
        float relief=.08+.90*max(0.0,dot(normalize(threadNormal),normalize(vec3(-.7,.4,1.0))));
        float rim=0.0;
        float contourFade=smoothstep(.12,.57,abs(normalize(threadNormal).z));
        float islands=.20+.80*smoothstep(.25,.72,fnoise(anatomical*vec2(15.0,11.0)+t*.025));
        float pulse=.68+.32*sin(t*1.1-threadUV.y*18.0+flow.x*7.0);
        outgoingLight*= (threads*.80+halo*.06)*(1.25+rim*.65)*relief*(.85+pulse*.5)*threadReveal;
        float edgeFade=smoothstep(.065,.115,threadUV.y);
        outgoingLight*=edgeFade*contourFade*islands;
        diffuseColor.a*=(threads*.70+halo*.045)*(.75+rim*.25)*threadReveal*edgeFade*contourFade*islands;
      `:`
        float t=threadTime*threadSpeed;
        float pulse=.5+.5*sin(threadUV.x*27.0-t*1.8+threadUV.y*24.0);
        outgoingLight*=(1.3+pow(pulse,8.0)*2.0)*threadReveal;
        float endFade=smoothstep(0.0,.10,threadUV.x)*(1.0-smoothstep(.90,1.0,threadUV.x));
        diffuseColor.a*=threadReveal*(.45+pulse*.40)*endFade;
        outgoingLight*=endFade;
      `;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',field+'\noutgoingLight*=threadBrightness*threadOpacity;\nif(diffuseColor.a<.008)discard;\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey=()=>volume?'quantum-volume-v2':surface?'quantum-woven-v2':'quantum-contours-v2';
    mesh.renderOrder=volume ? 0 : surface ? 1 : 2;
    mesh.material=material; previous.forEach(m=>m?.dispose()); materials.push(material);
  });
  doll.scene.background=null; doll.renderer.setClearColor(0x000000,0);
  doll.controls.target.set(0,1.67,0); doll.camera.position.set(0,1.67,2.70); doll.controls.update(); doll.cameraClock=null;
  let target=1,raf,disposed=false;const started=performance.now();let previous=started,measuredAt=started,frame=doll.renderer.info.render.frame;
  const tick=now=>{
    if(disposed)return;
    const dt=Math.min(.1,(now-previous)/1000);previous=now;
    uniforms.threadTime.value=(now-started)/1000;
    uniforms.threadReveal.value+=(target-uniforms.threadReveal.value)*(1-Math.exp(-dt*5));
    const stage=document.querySelector('#composite-stage');
    if(stage)stage.dataset.faceReveal=uniforms.threadReveal.value.toFixed(3);
    if(now-measuredAt>2000){
      const output=document.querySelector('#face-performance');
      const fps=Math.round((doll.renderer.info.render.frame-frame)*1000/(now-measuredAt));
      if(output){output.textContent=`Лицо: ${fps} fps · ${doll.renderer.info.render.triangles.toLocaleString('ru')} треугольников`;output.dataset.fps=String(fps);}
      measuredAt=now;frame=doll.renderer.info.render.frame;
    }
    raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return {tune(patch){visual=visualsOf({...visual,...patch}); uniforms.threadBrightness.value=visual.brightness;uniforms.threadOpacity.value=visual.opacity;uniforms.threadSpeed.value=visual.speed;materials.forEach(m=>{m.opacity=visual.opacity;});return {...visual};},reveal(value){target=value;},dispose(){disposed=true;cancelAnimationFrame(raf);},get revealValue(){return uniforms.threadReveal.value;}};
}
