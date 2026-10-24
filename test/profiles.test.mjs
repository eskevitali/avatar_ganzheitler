import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {manifestOf, settingsOf} from '../public/profiles.mjs';
import {catalog, validateGlb, saveSettings, readSettings, requiredBones, requiredMorphs} from '../profile-store.mjs';
import {install} from '../scripts/install-profile.mjs';
const current = JSON.parse(await readFile(new URL('../assets/user-mask/profile.json', import.meta.url)));
const original = await readFile(new URL('../assets/user-mask/' + current.model, import.meta.url));
const manifest = {formatVersion: 1, id: 'test-avatar', name: 'Current mask fixture', model: 'model.glb', body: 'F'};
function mutate(edit) {
  const length = original.readUInt32LE(12);
  const doc = JSON.parse(original.toString('utf8', 20, 20 + length));
  edit(doc);
  let json = JSON.stringify(doc); json += ' '.repeat((4 - Buffer.byteLength(json) % 4) % 4);
  const bytes = Buffer.concat([original.subarray(0, 20), Buffer.from(json), original.subarray(20 + length)]);
  bytes.writeUInt32LE(bytes.length, 8); bytes.writeUInt32LE(Buffer.byteLength(json), 12);
  return bytes;
}
test('bundled doll satisfies the package adapter, missing rig and morphs fail', () => {
  assert.ok(validateGlb(original));
  assert.throws(() => validateGlb(mutate(d => {d.nodes.find(n => n.name === 'Head').name = 'MissingHead';})), /Head/);
  assert.throws(() => validateGlb(mutate(d => {for (const m of d.meshes) if (m.extras?.targetNames) m.extras.targetNames = m.extras.targetNames.map(n => n === 'viseme_PP' ? 'missing' : n);})), /viseme_PP/);
  assert.throws(() => validateGlb(mutate(d => {d.images[0].uri = 'https:\/\/example.com/a.png';})), /встроены/);
  assert.throws(() => validateGlb(original.subarray(0, 100)), /GLB/);
});
test('manifest rejects unsupported versions, traversal, scripts and bad defaults', () => {
  for (const patch of [{formatVersion: 2}, {model: '../a.glb'}, {model: 'https://x/a.glb'}, {id: '__proto__'}, {body: 'other'}, {defaults: {mood: 'surprise'}}, {defaults: {lips: {PP: {jawOpen: 2}}}}]) assert.throws(() => manifestOf({...manifest, ...patch}));
  assert.equal(manifestOf(manifest).defaults.mood, 'neutral');
});
test('installation is discoverable without code changes; invalid/duplicate packages preserve files', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'avatar-package-'));
  try {
    const source = path.join(temp, 'source'), publicDir = path.join(temp, 'public');
    await mkdir(source); await mkdir(publicDir);
    await writeFile(path.join(source, 'profile.json'), JSON.stringify(manifest));
    await writeFile(path.join(source, 'model.glb'), original);
    await install(source, path.join(publicDir, 'profiles'));
    const result = await catalog(publicDir);
    assert.deepEqual(result.profiles.map(p => p.id), [manifest.id]);
    assert.equal(result.errors.length, 0);
    await assert.rejects(install(source, path.join(publicDir, 'profiles')), /установлен/);
    assert.deepEqual(await readFile(path.join(publicDir, 'profiles/test-avatar/model.glb')), original);
    await writeFile(path.join(publicDir, 'profiles/test-avatar/model.glb'), 'bad');
    const invalid = await catalog(publicDir);
    assert.equal(invalid.profiles.length, 0); assert.equal(invalid.errors.length, 1);
  } finally { await rm(temp, {recursive: true, force: true}); }
});
test('settings survive reload and stay independent per profile; invalid save preserves disk', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'avatar-settings-'));
  try {
    const file = path.join(temp, 'profiles.json');
    await Promise.all([saveSettings(file, 'user-mask', {mood: 'happy', lips: {PP: {jawOpen: 0.23}}}),
    saveSettings(file, 'another', {mood: 'sad', lips: {PP: {jawOpen: 0.67}}})]);
    const stored = await readSettings(file);
    assert.equal(stored['user-mask'].lips.PP.jawOpen, 0.23);
    assert.equal(stored.another.lips.PP.jawOpen, 0.67);
    await assert.rejects(saveSettings(file, 'user-mask', {mood: 'invalid'}));
    assert.deepEqual(await readSettings(file), stored);
    assert.equal(settingsOf(stored['user-mask']).mood, 'happy');
  } finally { await rm(temp, {recursive: true, force: true}); }
});
// Keep this list reviewable against the bundled loader when upgrading TalkingHead.
test('adapter lists all named pose bones used by the bundled vendor', async () => {
  const vendor = await readFile(new URL('../public/vendor/talkinghead.mjs', import.meta.url), 'utf8');
  const poseSection = vendor.slice(vendor.indexOf('this.poseTemplates ='), vendor.indexOf('this.posePropNames ='));
  for (const match of poseSection.matchAll(/'([A-Z][A-Za-z0-9]+)\.(?:rotation|position|quaternion|scale)'/g)) assert.ok(requiredBones.includes(match[1]), match[1]);
  assert.ok(requiredMorphs.includes('eyeBlinkLeft'));
});

test('fresh installation contains only the accepted profile and matches its revision', async () => {
  const {createHash} = await import('node:crypto');
  const revision = JSON.parse(await readFile(new URL('../assets/user-mask/revision.json', import.meta.url)));
  assert.equal(current.model, revision.model);
  assert.equal(createHash('sha256').update(original).digest('hex'), revision.sha256);
  const temp = await mkdtemp(path.join(os.tmpdir(), 'current-mask-'));
  try {
    await install(new URL('../assets/user-mask/', import.meta.url).pathname, path.join(temp, 'profiles'));
    const result = await catalog(temp);
    assert.deepEqual(result.profiles.map(p => p.id), ['user-mask']);
    assert.deepEqual(result.errors, []);
  } finally { await rm(temp, {recursive:true, force:true}); }
});
