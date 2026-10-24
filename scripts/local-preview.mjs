import {readFileSync, mkdirSync, existsSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local-preview');
mkdirSync(dir, {recursive: true});
for (const [name, size] of [['access.txt', 12], ['secret.txt', 32]]) {
  const file = path.join(dir, name);
  if (!existsSync(file)) writeFileSync(file, randomBytes(size).toString('base64url'), {mode: 0o600, flag: 'wx'});
}
process.env.APP_PASSWORD = readFileSync(path.join(dir, 'access.txt'), 'utf8').trim();
process.env.APP_SECRET = readFileSync(path.join(dir, 'secret.txt'), 'utf8').trim();
process.env.DEV_HTTP = '1';
process.env.PORT = process.env.PORT || '3100';
process.env.TTS_SETTINGS_PATH = path.join(dir, 'tts.json');
process.env.PROFILE_SETTINGS_PATH = path.join(dir, 'profiles.json');
if(!existsSync(path.join(dir,'../public/profiles/user-mask/profile.json'))){
  const {install}=await import('./install-profile.mjs');
  await install(path.join(dir,'../assets/user-mask'));
}
await import('../server.mjs');
