import {readFile, readdir, mkdir, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';
import {manifestOf, settingsOf, lipPoses} from './public/profiles.mjs';

// Fixed adapter contract for the bundled TalkingHead rig and fixed control panel.
export const requiredBones = ['Armature', 'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', ...['Left', 'Right'].flatMap(side => [
  'Eye', 'Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase',
  ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap(finger => [1, 2, 3].map(n => `Hand${finger}${n}`)),
].map(bone => side + bone))];
export const requiredMorphs = [...new Set([...Object.values(lipPoses).flatMap(Object.keys).filter(k => k !== 'mouthOpen'),
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight', 'mouthFrownLeft', 'mouthFrownRight',
  'jawForward', 'mouthLeft', 'mouthRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper'])];
export function validateGlb(bytes) {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Нужен корректный GLB 2.0');
  const end = 20 + bytes.readUInt32LE(12);
  if (end > bytes.length) throw new Error('Повреждён JSON GLB');
  const doc = JSON.parse(bytes.toString('utf8', 20, end));
  if (doc.asset?.version !== '2.0') throw new Error('Нужен glTF 2.0');
  if ([...(doc.buffers || []), ...(doc.images || [])].some(x => x.uri)) throw new Error('Ресурсы должны быть встроены в GLB');
  if (doc.extensionsRequired?.length) throw new Error('Сжатие и обязательные расширения GLB не поддерживаются пакетом v1');
  const nodes = doc.nodes || [];
  const roots = doc.scenes?.[doc.scene ?? 0]?.nodes || [];
  const reachable = new Set();
  function visit(i) { if (reachable.has(i)) return; if (!nodes[i]) throw new Error('Неверный узел GLB'); reachable.add(i); for (const child of nodes[i].children || []) visit(child); }
  roots.forEach(visit);
  const armature = [...reachable].find(i => nodes[i].name === 'Armature');
  const sceneNodes = new Set(reachable);
  reachable.clear();
  if (armature !== undefined) visit(armature);
  const names = new Set([...reachable].map(i => nodes[i].name));
  const morphs = new Set([...reachable].flatMap(i => {
    const mesh = doc.meshes?.[nodes[i].mesh];
    const targets = mesh?.extras?.targetNames || [];
    return targets.filter((_, index) => mesh.primitives?.some(p => p.targets?.[index]));
  }));
  const missing = [...requiredBones.filter(x => !names.has(x)), ...requiredMorphs.filter(x => !morphs.has(x))];
  if (!sceneNodes.size || missing.length) throw new Error(`Несовместимая модель, отсутствуют: ${missing.join(', ') || 'сцена'}`);
  return doc;
}
export async function catalog(publicDir) {
  const profiles = [], errors = [];
  const dir = path.join(publicDir, 'profiles');
  for (const entry of await readdir(dir, {withFileTypes: true}).catch(e => { if (e.code === 'ENOENT') return []; throw e; })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    try {
      const folder = path.join(dir, entry.name);
      const profile = manifestOf(JSON.parse(await readFile(path.join(folder, 'profile.json'), 'utf8')));
      if (profile.id !== entry.name || profiles.some(p => p.id === profile.id)) throw new Error('id должен совпадать с папкой и быть уникальным');
      validateGlb(await readFile(path.join(folder, profile.model)));
      profiles.push({...profile, url: `/profiles/${profile.id}/${profile.model}`});
    } catch (e) { errors.push({id: entry.name, message: e.message}); }
  }
  return {profiles, errors};
}
export async function readSettings(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}
const writes = new Map();
export async function saveSettings(file, id, value) {
  // Serialize read/modify/write per file so concurrent requests cannot lose another profile.
  const checked = settingsOf(value);
  const operation = (writes.get(file) || Promise.resolve()).catch(() => {}).then(() => writeSettings(file, id, checked));
  writes.set(file, operation);
  operation.finally(() => { if (writes.get(file) === operation) writes.delete(file); }).catch(() => {});
  return operation;
}
async function writeSettings(file, id, value) {
  const next = {...await readSettings(file), [id]: settingsOf(value)};
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(`${file}.tmp`, JSON.stringify(next), {mode: 0o600});
  await rename(`${file}.tmp`, file);
  return next[id];
}
