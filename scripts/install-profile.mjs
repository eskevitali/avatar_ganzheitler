import {readFile, mkdir, mkdtemp, copyFile, writeFile, rename, rm, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {manifestOf} from '../public/profiles.mjs';
import {validateGlb} from '../profile-store.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function install(source, destination = path.join(root, 'public/profiles')) {
  const profile = manifestOf(JSON.parse(await readFile(path.join(source, 'profile.json'), 'utf8')));
  if (profile.id === 'training') throw new Error('id training зарезервирован');
  const model = path.join(source, profile.model);
  if (!(await lstat(model)).isFile()) throw new Error('Модель должна быть обычным файлом');
  validateGlb(await readFile(model));
  await mkdir(destination, {recursive: true});
  const target = path.join(destination, profile.id);
  try { await lstat(target); throw new Error('Профиль уже установлен; используйте новый id для новой версии'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const stage = await mkdtemp(path.join(destination, '.install-'));
  try {
    await copyFile(model, path.join(stage, profile.model));
    await writeFile(path.join(stage, 'profile.json'), JSON.stringify(profile, null, 2));
    await rename(stage, target);
  } finally { await rm(stage, {recursive: true, force: true}); }
  return profile;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Использование: node scripts/install-profile.mjs /путь/к/пакету');
    console.log(`Установлен: ${(await install(path.resolve(process.argv[2]))).id}. Обновите страницу приложения.`);
  } catch (e) { console.error(`Профиль не установлен: ${e.message}`); process.exitCode = 1; }
}
