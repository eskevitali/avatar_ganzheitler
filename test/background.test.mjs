import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {backgroundSettings, backgroundStore} from '../background-state.mjs';
test('background settings are bounded data; invalid values cannot replace the saved state', () => {
  const dir=mkdtempSync(path.join(tmpdir(),'background-test-'));
  try {
    const file=path.join(dir,'background.json');const store=backgroundStore(file);
    assert.deepEqual(store.read(),{motion:true,strength:78});
    store.write({motion:false,strength:44});
    assert.deepEqual(backgroundStore(file).read(),{motion:false,strength:44});
    for(const value of [null,{}, {motion:'yes',strength:44},{motion:true,strength:101},{motion:true,strength:NaN}]) assert.throws(()=>store.write(value));
    assert.deepEqual(JSON.parse(readFileSync(file)),{motion:false,strength:44});
    const snapshot=store.read();snapshot.motion=true;assert.equal(store.read().motion,false);
    assert.deepEqual(backgroundSettings({motion:true,strength:0,script:'ignored'}),{motion:true,strength:0});
  } finally {rmSync(dir,{recursive:true,force:true});}
});
