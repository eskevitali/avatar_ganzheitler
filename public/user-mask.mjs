import * as THREE from 'three';
import {visualsOf} from './profiles.mjs';
import {advanceActivity} from './activity.mjs';

// User-authored neutral geometry and its exact baked UV projection stay intact.
// Only renderer-owned bounded light/motion effects are added to the live mesh.
export function attachUserMask(doll, appearance) {
  const transitionMs=appearance.transitionMs ?? 2400;
  let revealFrom=1,revealStarted=performance.now();
  let visual=visualsOf(appearance),target=1,reveal=1,activity=.08,audioLevel=0,remote=null,disposed=false;
  const uniforms={uTime:{value:0},uReveal:{value:1},uActivity:{value:.08},uBrightness:{value:visual.brightness},uOpacity:{value:visual.opacity},uSpeed:{value:visual.speed},uStrength:{value:appearance.activity?.strength ?? .5}};
  doll.animTemplateBlink={name:'blink',alt:[{delay:[2400,6500,1,2],dt:[120,65,170],vs:{eyeBlinkLeft:[1,1,0],eyeBlinkRight:[1,1,0]}}]};
  const meshes=[];doll.armature.traverse(m=>{if(m.isMesh)meshes.push(m);});
  const pivot=new THREE.Group();pivot.name='UserMaskMotion';pivot.position.set(0,1.67,0);doll.armature.add(pivot);
  const boundary=[];
  for(const mesh of meshes){
    mesh.geometry.computeVertexNormals();
    const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color;
    if(c?.itemSize===4)for(let i=0;i<p.count;i++)if(c.getW(i)<.13)boundary.push(new THREE.Vector3(p.getX(i),p.getY(i)-1.67,p.getZ(i)));
    pivot.add(mesh);mesh.position.y-=1.67;
    const old=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    mesh.material=old.map(previous=>{
      const material=new THREE.MeshBasicMaterial({map:previous.map || previous.emissiveMap,color:0xffffff,transparent:true,side:THREE.DoubleSide,depthWrite:true,vertexColors:Boolean(c)});
      material.name='UserAcceptedNeuralSurface';material.toneMapped=false;material.forceSinglePass=true;
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,uniforms);
        const declaration='uniform float uTime,uReveal,uActivity,uBrightness,uOpacity,uSpeed,uStrength; varying vec2 faceUv;\n';
        shader.vertexShader=declaration+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          faceUv=uv;
          float scatter=1.-uReveal;
          transformed.x+=scatter*.027*sin(uv.y*37.+uv.x*21.+uTime*.23);
          transformed.y+=scatter*.020*cos(uv.x*31.-uv.y*17.+uTime*.19);
          transformed.z+=scatter*.014*sin(uv.x*27.+uv.y*23.);
        `);
        shader.fragmentShader=declaration+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          float coverage=.24+.76*sqrt(clamp(lum*1.8,0.,1.));
          vec2 leftEye=(faceUv-vec2(.409,.38))/vec2(.063,.037);
          vec2 rightEye=(faceUv-vec2(.621,.38))/vec2(.063,.037);
          float eyes=max(exp(-dot(leftEye,leftEye)),exp(-dot(rightEye,rightEye)));
          coverage=mix(coverage,max(coverage,.85),eyes*.8);
          float t=uTime*uSpeed;
          float signal=.5+.5*sin(faceUv.x*67.+faceUv.y*89.-t*(.7+uActivity));
          float threadLight=pow(signal,18.)*smoothstep(.06,.45,lum)*.25;
          vec2 a=(faceUv-vec2(.48+.065*sin(t*.19),.21+.038*cos(t*.16)))/vec2(.11,.075);
          vec2 b=(faceUv-vec2(.59+.045*cos(t*.13),.28+.025*sin(t*.17)))/vec2(.085,.060);
          float glow=pow(max(0.,1.-dot(a,a)),3.)+pow(max(0.,1.-dot(b,b)),3.)*.65;
          float breath=.65+.35*sin(uTime*.65);
          float life=glow*(.10*breath+uActivity*.95)*uStrength;
          outgoingLight*=uBrightness*(1.+threadLight+life);
          vec2 cell=floor(faceUv*vec2(61.,47.));
          float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
          float assemble=smoothstep(seed*.55,seed*.55+.45,uReveal);
          diffuseColor.a*=coverage*uOpacity*uReveal*assemble;
          if(diffuseColor.a<.003)discard;
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey=()=> 'user-mask-live-v1';previous.dispose();return material;
    });
    if(mesh.material.length===1)mesh.material=mesh.material[0];
  }
  // Fine spatial strands grow out of the cropped boundary, not a PNG silhouette.
  let seed=231023;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const points=[],parameters=[];
  for(let strand=0;strand<Math.min(64,boundary.length);strand++){
    const start=boundary[Math.floor(random()*boundary.length)].clone();start.z+=.012;
    const radial=new THREE.Vector3(start.x,start.y*.7,0).normalize();
    const tangent=new THREE.Vector3(-radial.y,radial.x,0);const length=.014+random()*.026,phase=random()*6.28;
    let previous;
    for(let j=0;j<=24;j++){
      const t=j/24;const p=start.clone().addScaledVector(radial,length*t).addScaledVector(tangent,Math.sin(t*3.4+phase)*.004*Math.sin(t*Math.PI));p.z+=Math.sin(t*Math.PI+phase)*.006;
      if(previous){points.push(...previous.toArray(),...p.toArray());parameters.push((j-1)/24,phase,t,phase);}previous=p;
    }
  }
  const strandGeometry=new THREE.BufferGeometry();strandGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));strandGeometry.setAttribute('strandParam',new THREE.Float32BufferAttribute(parameters,2));
  const strandMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`attribute vec2 strandParam;varying vec2 vStrand;uniform float uTime,uSpeed;void main(){vStrand=strandParam;vec3 p=position;p.z+=sin(uTime*uSpeed*.6+strandParam.y+strandParam.x*5.)*.001*strandParam.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 vStrand;uniform float uTime,uReveal,uOpacity,uBrightness,uSpeed,uActivity;void main(){float s=.5+.5*sin(vStrand.x*17.-uTime*uSpeed*(1.+uActivity)+vStrand.y);float a=pow(1.-vStrand.x,1.3)*(.12+pow(s,9.)*.48)*uReveal*uOpacity;if(a<.004)discard;gl_FragColor=vec4(vec3(.015,.37,.85)*uBrightness*(.8+pow(s,12.)),a);}`});
  const strands=new THREE.LineSegments(strandGeometry,strandMaterial);strands.name='UserMaskSpatialStrands';pivot.add(strands);
  const mistPositions=[],mistSeeds=[];
  for(let i=0;i<Math.min(64,boundary.length);i++){
    const j=5+Math.floor(random()*12),offset=(i*24+j)*6;
    if(offset+2>=points.length)continue;
    mistPositions.push(points[offset],points[offset+1],points[offset+2]+.003);mistSeeds.push(random());
  }
  const mistGeometry=new THREE.BufferGeometry();mistGeometry.setAttribute('position',new THREE.Float32BufferAttribute(mistPositions,3));mistGeometry.setAttribute('mistSeed',new THREE.Float32BufferAttribute(mistSeeds,1));
  const mistMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`attribute float mistSeed;varying float vSeed;uniform float uTime;void main(){vSeed=mistSeed;vec3 p=position;p.z+=sin(uTime*.2+mistSeed*6.28)*.001;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((10.+mistSeed*11.)*(1.5/-mv.z),4.,18.);}`,fragmentShader:`varying float vSeed;uniform float uTime,uReveal,uOpacity,uBrightness;void main(){vec2 d=(gl_PointCoord-.5)*2.;float a=exp(-dot(d,d)*4.5)*.025*uReveal*uOpacity*(.8+.2*sin(uTime*.4+vSeed*6.28));if(a<.001)discard;gl_FragColor=vec4(vec3(.018,.24,.43)*uBrightness,a);}`});
  const mist=new THREE.Points(mistGeometry,mistMaterial);mist.name='UserMaskSubtleEdgeMist';pivot.add(mist);
  doll.nodeAvatar.classList.add('user-mask');doll.scene.background=null;doll.renderer.setClearColor(0,0);
  doll.controls.target.set(0,1.67,0);doll.camera.position.set(0,1.67,2.05);doll.controls.update();doll.cameraClock=null;
  const data=new Uint8Array(doll.audioAnalyzerNode?.fftSize || 256);
  let previous=performance.now(),started=previous,raf,nextTurn=0,yaw=0,pitch=0,yawV=0,pitchV=0,desiredYaw=0,desiredPitch=0,measured=previous,frame=doll.renderer.info.render.frame;
  const tick=now=>{
    if(disposed)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;
    let speaking=Boolean(doll.isSpeaking || doll.isAudioPlaying);audioLevel=0;
    if(remote && now-remote.at<400){speaking=remote.speaking;audioLevel=remote.rms;}
    else if(speaking && doll.audioAnalyzerNode){doll.audioAnalyzerNode.getByteTimeDomainData(data);let e=0;for(const n of data)e+=((n-128)/128)**2;audioLevel=Math.sqrt(e/data.length);}
    if(speaking && now>=nextTurn){desiredYaw=(random()-.5)*.17;desiredPitch=(random()-.5)*.08;nextTurn=now+1500+random()*2600;}
    if(!speaking){desiredYaw=0;desiredPitch=0;nextTurn=0;}
    const w=3.1;yawV+=((desiredYaw-yaw)*w*w-2*w*yawV)*dt;pitchV+=((desiredPitch-pitch)*w*w-2*w*pitchV)*dt;yaw+=yawV*dt;pitch+=pitchV*dt;pivot.rotation.set(pitch,yaw,0);
    activity=advanceActivity(activity,audioLevel,speaking,dt);
    const phase=Math.min(1,Math.max(0,(now-revealStarted)/transitionMs)),ease=phase*phase*(3-2*phase);reveal=revealFrom+(target-revealFrom)*ease;
    uniforms.uReveal.value=reveal;uniforms.uTime.value=(now-started)/1000;uniforms.uActivity.value=activity;
    const stage=document.querySelector('#composite-stage');
    if(stage){stage.dataset.maskGeometry='user-accepted-2026-10-23';stage.dataset.faceReveal=reveal.toFixed(3);stage.dataset.lightActivity=activity.toFixed(3);stage.dataset.audioLevel=audioLevel.toFixed(3);stage.dataset.activityMode=speaking?'speech':'idle';stage.dataset.headYaw=yaw.toFixed(4);stage.dataset.headPitch=pitch.toFixed(4);stage.dataset.userMouth=String(doll.mtAvatar?.viseme_aa?.value || doll.mtAvatar?.viseme_O?.value || 0);stage.dataset.blinkLeft=String(doll.mtAvatar?.eyeBlinkLeft?.value||0);stage.dataset.blinkRight=String(doll.mtAvatar?.eyeBlinkRight?.value||0);stage.dataset.blinkPeak=String(Math.max(Number(stage.dataset.blinkPeak||0),doll.mtAvatar?.eyeBlinkLeft?.value||0,doll.mtAvatar?.eyeBlinkRight?.value||0));}
    if(now-measured>2000){const fps=Math.round((doll.renderer.info.render.frame-frame)*1000/(now-measured));const output=document.querySelector('#face-performance');if(output){output.textContent=`Ваша маска: ${fps} fps · ${doll.renderer.info.render.triangles.toLocaleString('ru')} треугольников`;output.dataset.fps=String(fps);}measured=now;frame=doll.renderer.info.render.frame;}
    raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
  return {transitionMs,formationLeadMs:Math.round(transitionMs*.82),reveal(v){const next=v?1:0;if(next===target)return;revealFrom=reveal;revealStarted=performance.now();target=next;},get revealValue(){return reveal;},get audioLevel(){return audioLevel;},get activityLevel(){return activity;},react(rms,speaking){remote={rms:Math.min(1,Math.max(0,Number(rms)||0)),speaking:Boolean(speaking),at:performance.now()};},tune(patch){visual=visualsOf({...visual,...patch});uniforms.uBrightness.value=visual.brightness;uniforms.uOpacity.value=visual.opacity;uniforms.uSpeed.value=visual.speed;uniforms.uStrength.value=visual.activityStrength ?? appearance.activity?.strength ?? .5;return {...visual};},dispose(){disposed=true;cancelAnimationFrame(raf);strandGeometry.dispose();strandMaterial.dispose();mistGeometry.dispose();mistMaterial.dispose();}};
}
