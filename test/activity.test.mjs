import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceActivity} from '../public/activity.mjs';
import {appearanceOf, visualsOf} from '../public/profiles.mjs';
test('light envelope rises during real speech, follows audio and smoothly returns to idle',()=>{
 let level=.08;
 const first=advanceActivity(level,.08,true,.04);assert.ok(first>.08 && first<.8,'no instantaneous flash');
 for(let i=0;i<25;i++)level=advanceActivity(level,.08,true,.04);
 assert.ok(level>.7);
 const active=level;
 for(let i=0;i<75;i++)level=advanceActivity(level,0,false,.04);
 assert.ok(level<.081 && level>=.08);
 assert.ok(advanceActivity(.08,.12,true,.04)>advanceActivity(.08,.01,true,.04));
 assert.ok(advanceActivity(active,0,false,.04)<active);
 assert.ok(Number.isFinite(advanceActivity(NaN,Infinity,false,Infinity)));
});
test('activity package settings are restricted data and remain optional',()=>{
 const base={type:'filaments',color:'#009fe8'};
 assert.equal(appearanceOf(base).activity,undefined);
 assert.deepEqual(appearanceOf({...base,activity:{type:'neural-glow',strength:.65}}).activity,{type:'neural-glow',strength:.65});
 for(const activity of [{type:'script',strength:.5},{type:'neural-glow',strength:2},{type:'neural-glow',strength:NaN}])assert.throws(()=>appearanceOf({...base,activity}));
 assert.equal(visualsOf({activityStrength:.4}).activityStrength,.4);
 assert.throws(()=>visualsOf({activityStrength:-1}));
});
