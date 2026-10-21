import {readFileSync, mkdirSync, writeFileSync, renameSync} from 'node:fs';
import path from 'node:path';
export const defaultBackground = {motion: true, strength: 78};
export function backgroundSettings(value) {
  if (!value || typeof value.motion !== 'boolean' || typeof value.strength !== 'number' || !Number.isFinite(value.strength) || value.strength < 0 || value.strength > 100) throw new Error('Нужны motion true/false и strength от 0 до 100.');
  return {motion: value.motion, strength: value.strength};
}
export function backgroundStore(file) {
  let settings = {...defaultBackground};
  try { settings = backgroundSettings(JSON.parse(readFileSync(file, 'utf8'))); } catch {}
  return {
    read() { return {...settings}; },
    write(value) {
      const next = backgroundSettings(value);
      mkdirSync(path.dirname(file), {recursive:true});
      writeFileSync(`${file}.tmp`, JSON.stringify(next), {mode:0o600});
      renameSync(`${file}.tmp`, file);
      settings = next;
      return {...settings};
    },
  };
}
