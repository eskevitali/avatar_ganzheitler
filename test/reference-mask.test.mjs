import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateGlb} from '../profile-store.mjs';
const bytes=readFileSync(new URL('../assets/reference-mask-002/reference-mask.glb',import.meta.url));
const gltf=validateGlb(bytes),jsonLength=bytes.readUInt32LE(12),bin=bytes.subarray(28+jsonLength);
const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function values(index){
 const a=gltf.accessors[index],width=size[a.type],out=new Float32Array(a.count*width);
 if(a.bufferView!==undefined){const v=gltf.bufferViews[a.bufferView];for(let i=0;i<out.length;i++)out[i]=bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+i*4);}
 if(a.sparse){const s=a.sparse,iv=gltf.bufferViews[s.indices.bufferView],vv=gltf.bufferViews[s.values.bufferView];for(let i=0;i<s.count;i++){const k=bin.readUInt32LE((iv.byteOffset||0)+i*4);for(let j=0;j<width;j++)out[k*width+j]=bin.readFloatLE((vv.byteOffset||0)+(i*width+j)*4);}}
 return out;
}
const mesh=gltf.meshes[0],face=mesh.primitives[0],pos=values(face.attributes.POSITION),uv=values(face.attributes.TEXCOORD_0);
function closest(u,v){let best=0,d=Infinity;for(let i=0;i<uv.length/2;i++){const e=(uv[i*2]-u)**2+(uv[i*2+1]-v)**2;if(e<d){best=i;d=e;}}return best;}
test('reference mask is portable 3D geometry with a registered texture and no rear shell',()=>{
 assert.equal(mesh.extras.frontMaskOnly,true);assert.equal(mesh.primitives.length,4);
 assert.ok(bytes.length<8_000_000);
 const z=Array.from({length:pos.length/3},(_,i)=>pos[i*3+2]);assert.ok(Math.max(...z)-Math.min(...z)>.04,'mask has physical relief');
 assert.ok(Math.min(...z)>.015,'visible face contains no occiput');
 const image=gltf.images[0],view=gltf.bufferViews[image.bufferView];const embedded=bin.subarray(view.byteOffset,view.byteOffset+view.byteLength);
 const source=readFileSync(new URL('../assets/reference-mask-002/reference.png',import.meta.url));
 assert.equal(createHash('sha256').update(embedded).digest('hex'),createHash('sha256').update(source).digest('hex'));
});
test('compact nose depth is bounded and every mouth morph leaves the nose stationary',()=>{
 const nose=closest(.5355,.509),cheek=closest(.429,.51);
 assert.ok(pos[nose*3+2]-pos[cheek*3+2]<.016,'nose is not an exaggerated projecting spike');
 for(const name of mesh.extras.targetNames.filter(n=>/^(mouth|jaw|viseme_)/.test(n))){
  const delta=values(face.targets[mesh.extras.targetNames.indexOf(name)].POSITION);
  for(let i=0;i<uv.length/2;i++)if(uv[i*2]>.49&&uv[i*2]<.58&&uv[i*2+1]>.43&&uv[i*2+1]<.54){assert.equal(delta[i*3],0,name);assert.equal(delta[i*3+1],0,name);assert.equal(delta[i*3+2],0,name);}
 }
});
test('upper and lower lip share the measured seam at rest and separate on that seam',()=>{
 const u=.5355,points=mesh.extras.referenceLandmarks.mouthSeam;
 let v;
 for(let i=0;i<points.length-1;i++){const[a,b]=points[i],[c,d]=points[i+1];if(u>=a&&u<=c)v=b+(d-b)*(u-a)/(c-a);}
 const lips=[];
 for(let i=0;i<uv.length/2;i++)if(Math.abs(uv[i*2]-u)<1e-6&&Math.abs(uv[i*2+1]-v)<1e-6)lips.push(i);
 assert.equal(lips.length,2,'both lips are registered to the same measured texture seam');
 for(let j=0;j<3;j++)assert.ok(Math.abs(pos[lips[0]*3+j]-pos[lips[1]*3+j])<1e-6);
 const open=values(face.targets[mesh.extras.targetNames.indexOf('jawOpen')].POSITION);
 assert.ok(open[lips[0]*3+1]>0&&open[lips[1]*3+1]<0,'the visible lip edges bound the real opening');
});
