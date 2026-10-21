import {lipKeys} from './mouth.mjs';
export const moods = ['neutral', 'happy', 'sad', 'angry', 'fear'];
export const lipPoses = {
  PP: {viseme_PP: 1, mouthClose: 0.55, jawOpen: 0.02},
  aa: {viseme_aa: 1, jawOpen: 0.85, mouthOpen: 0.45},
  O: {viseme_O: 1, jawOpen: 0.42, mouthFunnel: 0.8, mouthPucker: 0.45},
  I: {viseme_I: 1, jawOpen: 0.16, mouthSmileLeft: 0.7, mouthSmileRight: 0.7, mouthStretchLeft: 0.35, mouthStretchRight: 0.35},
};
export function settingsOf(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Неверные настройки профиля');
  const mood = value.mood ?? 'neutral';
  if (!moods.includes(mood)) throw new Error('Неизвестная мимика');
  const lips = structuredClone(lipPoses);
  for (const [pose, values] of Object.entries(value.lips ?? {})) {
    if (!Object.hasOwn(lips, pose) || !values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Неизвестная форма губ');
    for (const [key, number] of Object.entries(values)) {
      if (!lipKeys.includes(key) || typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 1) throw new Error('Параметры губ должны быть от 0 до 1');
      lips[pose][key] = number;
    }
  }
  return {mood, lips};
}
export function manifestOf(raw) {
  if (raw?.formatVersion !== 1) throw new Error('Поддерживается formatVersion: 1');
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(raw.id)) throw new Error('Неверный id профиля');
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100) throw new Error('Нужно имя профиля до 100 символов');
  if (typeof raw.model !== 'string' || !/^[a-zA-Z0-9_-]+\.glb$/.test(raw.model)) throw new Error('Модель должна быть локальным файлом .glb без пути');
  if (!['F', 'M'].includes(raw.body)) throw new Error('body должен быть F или M');
  if (!['head', 'upper', 'mid', 'full'].includes(raw.cameraView ?? 'head')) throw new Error('Неизвестный cameraView');
  return {formatVersion: 1, id: raw.id, name: raw.name.trim(), model: raw.model, body: raw.body, cameraView: raw.cameraView ?? 'head', defaults: settingsOf(raw.defaults)};
}
