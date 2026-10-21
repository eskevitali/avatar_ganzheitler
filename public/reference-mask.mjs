import * as THREE from 'three';
import {visualsOf} from './profiles.mjs';
import {advanceActivity} from './activity.mjs';

// Reference 002 is registered on the new sculpt; there is no portrait plane.
// No portrait canvas, screen-space mouth, or independent facial overlay exists.
export function attachReferenceMask(doll, appearance) {
  let visual=visualsOf(appearance),target=1,reveal=1,activity=.08,audioLevel=0,remote=null;
  const uniforms={maskReveal:{value:1},maskTime:{value:0},maskActivity:{value:.08},maskBrightness:{value:visual.brightness},maskOpacity:{value:visual.opacity},maskActivityStrength:{value:appearance.activity?.strength ?? .4}};
  const meshes=[];doll.armature.traverse(m=>{if(m.isMesh)meshes.push(m);});
  const pivot=new THREE.Group();pivot.name='ReferenceMaskMotion';pivot.position.set(0,1.67,0);doll.armature.add(pivot);
  const materials=[];
  for(const mesh of meshes) {
    mesh.geometry.computeVertexNormals();
    pivot.add(mesh);mesh.position.y-=1.67;
    const old=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    mesh.material=old.map(previous=>{
      const material=new THREE.MeshBasicMaterial({map:previous.map,color:0xffffff,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:true,vertexColors:Boolean(mesh.geometry.attributes.color)});
      material.name=previous.name;material.toneMapped=false;material.forceSinglePass=true;
      // The cavity is behind the animated lips and eyes are behind their lids.
      mesh.renderOrder=previous.name==='MouthInterior'?0:previous.name==='ReferenceEyes'?1:2;
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,uniforms);
        const decl='uniform float maskReveal; uniform float maskTime; uniform float maskActivity; uniform float maskBrightness; uniform float maskOpacity; uniform float maskActivityStrength; varying vec2 maskUv; varying vec3 maskNormal;\n';
        shader.vertexShader=decl+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          maskUv=uv; maskNormal=normalize(normalMatrix*normal);
          float scatter=(1.-maskReveal);
          transformed.x+=scatter*.038*sin(uv.y*29.+uv.x*17.+maskTime*.35);
          transformed.y+=scatter*.025*cos(uv.x*37.-uv.y*19.+maskTime*.3);
          transformed.z+=scatter*.018*sin(uv.x*23.+uv.y*31.);
        `);
        shader.fragmentShader=decl+`
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          vec2 site(vec2 p){return vec2(hash(p),hash(p+17.7));}
          float segment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/max(.0001,dot(d,d)),0.,1.));}
          vec2 neural(vec2 uv){
            vec2 p=uv*vec2(57.,63.),cell=floor(p);
            float a=100.,b=100.,c=100.;vec2 q1=vec2(0.),q2=vec2(0.),q3=vec2(0.);
            for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
              vec2 k=cell+vec2(float(x),float(y));vec2 q=k+site(k)*.80+.10;float d=dot(p-q,p-q);
              if(d<a){c=b;q3=q2;b=a;q2=q1;a=d;q1=q;}else if(d<b){c=b;q3=q2;b=d;q2=q;}else if(d<c){c=d;q3=q;}
            }
            float d=min(segment(p,q1,q2),min(segment(p,q1,q3),segment(p,q2,q3)));
            float aa=max(.025,fwidth(d));float line=1.-smoothstep(.016,.016+aa,d);
            float point=pow(max(0.,1.-sqrt(a)/.12),3.);
            return vec2(line,point);
          }
        `+shader.fragmentShader;
        const kind=previous.name;
        const paint=kind==='MouthInterior'?`outgoingLight=vec3(.001,.007,.018); diffuseColor.a=1.;`:
        kind==='ReferenceEyes'?`
          outgoingLight=diffuseColor.rgb;
          diffuseColor.a*=.98;
        `:kind==='ReferenceStrands'?`
          float signal=.5+.5*sin(maskUv.x*53.+maskUv.y*61.-maskTime*(.6+maskActivity));
          outgoingLight=vec3(.025,.48,.95)*( .95+pow(signal,9.)*2.5);
          diffuseColor.a=.32+pow(signal,5.)*.45;
        `:`
          vec2 network=vec2(0.);
          float facing=abs(normalize(maskNormal).z);
          float illumination=.26+.74*max(0.,dot(normalize(maskNormal),normalize(vec3(-.4,.55,1.))));
          float contour=smoothstep(.10,.52,facing);
          float oval=pow((maskUv.x-.5355)/.255,2.)+pow((maskUv.y-.477)/.414,2.);
          float v=maskUv.y;
          float width=.018;
          if(v<.13)width=mix(.055,.145,clamp((v-.08)/.05,0.,1.));
          else if(v<.22)width=mix(.145,.205,(v-.13)/.09);
          else if(v<.34)width=mix(.205,.235,(v-.22)/.12);
          else if(v<.45)width=mix(.235,.240,(v-.34)/.11);
          else if(v<.54)width=mix(.240,.224,(v-.45)/.09);
          else if(v<.64)width=mix(.224,.199,(v-.54)/.10);
          else if(v<.73)width=mix(.199,.164,(v-.64)/.09);
          else if(v<.82)width=mix(.164,.108,(v-.73)/.09);
          else width=mix(.108,.018,clamp((v-.82)/.06,0.,1.));
          float side=abs(maskUv.x-.5355)/width+.018*sin(maskUv.y*173.);
          float boundary=(1.-smoothstep(.66,1.,side))*(1.-smoothstep(.74,.875,v))*smoothstep(.08,.16,v);
          float lips=exp(-pow((maskUv.x-.5355)/.078,2.)-pow((maskUv.y-.625)/.034,2.));
          vec3 referenceColor=diffuseColor.rgb;
          outgoingLight=referenceColor*(.82+illumination*.18);
          outgoingLight+=vec3(.015,.18,.32)*network.x*.18;
          outgoingLight+=vec3(.15,.40,.60)*network.y*.30;
          diffuseColor.a*=boundary*contour;
        `;
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',paint+`
          vec2 cell=floor(maskUv*vec2(55.,43.));
          float seed=hash(cell);
          float assemble=smoothstep(seed*.60,seed*.60+.40,maskReveal);
          float drift=maskTime*.25;
          vec2 d=(maskUv-vec2(.50+.075*sin(drift),.235+.035*cos(drift*.7)))/vec2(.12,.075);
          float glow=pow(max(0.,1.-dot(d,d)),3.);
          float life=glow*(.12*(.65+.35*sin(maskTime*.65))+maskActivity*.8)*maskActivityStrength;
          outgoingLight*=maskBrightness*(1.+life);
          diffuseColor.a*=maskReveal*assemble*maskOpacity;
          if(diffuseColor.a<.004)discard;
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey=()=>`reference-mask-002-sculpt:${previous.name}`;
      previous.dispose();materials.push(material);return material;
    });
    if(mesh.material.length===1)mesh.material=mesh.material[0];
  }
  doll.nodeAvatar.classList.add('reference-mask');
  doll.scene.background=null;doll.renderer.setClearColor(0,0);
  doll.controls.target.set(0,1.67,0);doll.camera.position.set(0,1.67,2.35);doll.controls.update();doll.cameraClock=null;
  const audioData=new Uint8Array(doll.audioAnalyzerNode?.fftSize || 256);
  let raf,disposed=false,previous=performance.now(),started=previous,nextTurn=0,yaw=0,pitch=0,yawV=0,pitchV=0,targetYaw=0,targetPitch=0,measured=previous,frame=doll.renderer.info.render.frame;
  const tick=now=>{
    if(disposed)return;
    const dt=Math.min(.05,(now-previous)/1000);previous=now;
    let speaking=Boolean(doll.isSpeaking || doll.isAudioPlaying);audioLevel=0;
    if(remote && now-remote.at<400){speaking=remote.speaking;audioLevel=remote.rms;}
    else if(speaking && doll.audioAnalyzerNode){doll.audioAnalyzerNode.getByteTimeDomainData(audioData);let e=0;for(const n of audioData)e+=((n-128)/128)**2;audioLevel=Math.sqrt(e/audioData.length);}
    if(speaking && now>=nextTurn){targetYaw=(Math.random()-.5)*.19;targetPitch=(Math.random()-.5)*.10;nextTurn=now+1500+Math.random()*2800;}
    if(!speaking){targetYaw=0;targetPitch=0;nextTurn=0;}
    // Critically damped angular movement: random targets, no periodic head waggle.
    const w=3.2;
    yawV+=((targetYaw-yaw)*w*w-2*w*yawV)*dt;pitchV+=((targetPitch-pitch)*w*w-2*w*pitchV)*dt;
    yaw+=yawV*dt;pitch+=pitchV*dt;pivot.rotation.set(pitch,yaw,0);
    activity=advanceActivity(activity,audioLevel,speaking,dt);
    reveal+=(target-reveal)*(1-Math.exp(-dt*5));
    uniforms.maskReveal.value=reveal;uniforms.maskTime.value=(now-started)/1000;uniforms.maskActivity.value=activity;
    const stage=document.querySelector('#composite-stage');
    if(stage){stage.dataset.faceReveal=reveal.toFixed(3);stage.dataset.lightActivity=activity.toFixed(3);stage.dataset.audioLevel=audioLevel.toFixed(3);stage.dataset.activityMode=speaking?'speech':'idle';stage.dataset.headYaw=yaw.toFixed(4);stage.dataset.headPitch=pitch.toFixed(4);stage.dataset.maskGeometry='reference-002-3d';stage.dataset.liveJaw=String(doll.mtAvatar?.jawOpen?.value || 0);stage.dataset.blinkPeak=String(Math.max(Number(stage.dataset.blinkPeak||0),doll.mtAvatar?.eyeBlinkLeft?.value||0,doll.mtAvatar?.eyeBlinkRight?.value||0));}
    if(now-measured>2000){const output=document.querySelector('#face-performance');if(output){output.textContent=`Маска: ${Math.round((doll.renderer.info.render.frame-frame)*1000/(now-measured))} fps · ${doll.renderer.info.render.triangles.toLocaleString('ru')} треугольников`; }measured=now;frame=doll.renderer.info.render.frame;}
    raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
  return {reveal(v){target=v?1:0;},get revealValue(){return reveal;},get audioLevel(){return audioLevel;},get activityLevel(){return activity;},react(rms,speaking){remote={rms:Math.min(1,Math.max(0,Number(rms)||0)),speaking:Boolean(speaking),at:performance.now()};},tune(patch){visual=visualsOf({...visual,...patch});uniforms.maskBrightness.value=visual.brightness;uniforms.maskOpacity.value=visual.opacity;uniforms.maskActivityStrength.value=visual.activityStrength ?? appearance.activity?.strength ?? .4;return {...visual};},dispose(){disposed=true;cancelAnimationFrame(raf);}};
}
