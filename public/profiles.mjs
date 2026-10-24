import {attentionOf} from './attention.mjs';
import {lipKeys} from './mouth.mjs';
export const moods = ['neutral', 'happy', 'sad', 'angry', 'fear'];
export const lipPoses = {
  PP: {viseme_PP: 1, mouthClose: 0.55, jawOpen: 0.02},
  aa: {viseme_aa: 1, jawOpen: 0.85, mouthOpen: 0.45},
  O: {viseme_O: 1, jawOpen: 0.42, mouthFunnel: 0.8, mouthPucker: 0.45},
  I: {viseme_I: 1, jawOpen: 0.16, mouthSmileLeft: 0.7, mouthSmileRight: 0.7, mouthStretchLeft: 0.35, mouthStretchRight: 0.35},
};
export function visualsOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Неверные настройки волокон');
  const result = {};
  for (const [key, fallback, min, max] of [['opacity', .52, .05, 1], ['brightness', 1.6, .2, 3], ['speed', .7, 0, 2]]) {
    const n = value[key] ?? fallback;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`visuals.${key}: вне диапазона`);
    result[key] = n;
  }
  if (value.activityStrength !== undefined) {
    const n=value.activityStrength;
    if (typeof n!=='number' || !Number.isFinite(n) || n<0 || n>1) throw new Error('visuals.activityStrength: вне диапазона');
    result.activityStrength=n;
  }
  return result;
}
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
  return {mood, lips, ...(value.visuals === undefined ? {} : {visuals:visualsOf(value.visuals)})};
}
export function appearanceOf(raw) {
  if (raw === undefined) return undefined;
  if (!raw || raw.type !== 'filaments') throw new Error('Неизвестный тип appearance');
  if (!/^#[0-9a-fA-F]{6}$/.test(raw.color)) throw new Error('appearance.color: нужен #RRGGBB');
  if (raw.style !== undefined && !['lines', 'woven', 'reference-mask', 'user-mask'].includes(raw.style)) throw new Error('Неизвестный стиль волокон');
  const result = {type: 'filaments', style: raw.style || 'lines', color: raw.color};
  for (const [key, fallback, min, max] of [['opacity', .52, .05, 1], ['brightness', 1.6, .2, 3], ['speed', .7, 0, 2], ['amplitude', .00035, 0, .002]]) {
    const value = raw[key] ?? fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`appearance.${key}: вне диапазона`);
    result[key] = value;
  }
  if (raw.transitionMs !== undefined) {
    if (!Number.isFinite(raw.transitionMs) || raw.transitionMs<800 || raw.transitionMs>6000) throw new Error('appearance.transitionMs: вне диапазона');
    result.transitionMs=raw.transitionMs;
  }
  if (raw.attention !== undefined) result.attention=attentionOf(raw.attention);
  if (raw.activity !== undefined) {
    if (!raw.activity || raw.activity.type!=='neural-glow' || typeof raw.activity.strength!=='number' || !Number.isFinite(raw.activity.strength) || raw.activity.strength<0 || raw.activity.strength>1) throw new Error('Неизвестный или неверный effect activity');
    result.activity={type:'neural-glow', strength:raw.activity.strength};
  }
  return result;
}
export function manifestOf(raw) {
  if (raw?.formatVersion !== 1) throw new Error('Поддерживается formatVersion: 1');
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(raw.id)) throw new Error('Неверный id профиля');
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100) throw new Error('Нужно имя профиля до 100 символов');
  if (typeof raw.model !== 'string' || !/^[a-zA-Z0-9_-]+\.glb$/.test(raw.model)) throw new Error('Модель должна быть локальным файлом .glb без пути');
  if (!['F', 'M'].includes(raw.body)) throw new Error('body должен быть F или M');
  if (!['head', 'upper', 'mid', 'full'].includes(raw.cameraView ?? 'head')) throw new Error('Неизвестный cameraView');
  return {formatVersion: 1, id: raw.id, name: raw.name.trim(), model: raw.model, body: raw.body, cameraView: raw.cameraView ?? 'head', defaults: settingsOf(raw.defaults), ...(raw.appearance === undefined ? {} : {appearance: appearanceOf(raw.appearance)})};
}
