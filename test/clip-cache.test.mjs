import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readClipCache,writeClipCache,clearClipCache} from '../public/clip-cache.mjs';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('reload cache reuses only the same phrase/voice/model within its lifetime',()=>{
 const s=storage(),payload={audio_base64:'AAAA',alignment:null};
 writeClipCache(s,'тест','voice-model-a',payload,1000);
 assert.deepEqual(readClipCache(s,'тест','voice-model-a',2000),payload);
 assert.equal(readClipCache(s,'другая фраза','voice-model-a',2000),null);
 assert.equal(readClipCache(s,'тест','voice-model-b',2000),null);
 assert.equal(readClipCache(s,'тест','voice-model-a',1000+31*60*1000),null);
 clearClipCache(s);assert.equal(readClipCache(s,'тест','voice-model-a',2000),null);
});
test('blocked storage and malformed cache do not break speech',()=>{
 const s={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.equal(readClipCache(s,'x','v'),null);assert.doesNotThrow(()=>writeClipCache(s,'x','v',{}));assert.doesNotThrow(()=>clearClipCache(s));
});
