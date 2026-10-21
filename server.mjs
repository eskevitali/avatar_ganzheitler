import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {createReadStream, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {readFile, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {catalog, readSettings, saveSettings} from './profile-store.mjs';
import {settingsOf} from './public/profiles.mjs';
import {ttsError} from './tts-errors.mjs';
import {backgroundStore, backgroundSettings} from './background-state.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const password = process.env.APP_PASSWORD || '';
const devHttp = process.env.DEV_HTTP === '1';
const secret = process.env.APP_SECRET || '';
const apiKey = process.env.ELEVENLABS_API_KEY || '';
const voiceModels = {
  eleven_flash_v2_5: 'Flash v2.5',
  eleven_v3_conversational: 'v3 Conversational',
};
const settingsPath = process.env.TTS_SETTINGS_PATH || '/data/settings/tts.json';
const profileSettingsPath = process.env.PROFILE_SETTINGS_PATH || path.join(path.dirname(settingsPath), 'profiles.json');
const background = backgroundStore(process.env.BACKGROUND_SETTINGS_PATH || path.join(path.dirname(settingsPath), 'background.json'));
const envVoice = process.env.ELEVENLABS_VOICE_ID || '';
const envModel = process.env.ELEVENLABS_MODEL_ID || '';
let activeVoice = envVoice;
let activeModel = voiceModels[envModel] ? envModel : 'eleven_flash_v2_5';
const maxText = 4000;
const sessionMs = 12 * 60 * 60 * 1000;
const loginRequired = true;

if (!password || !secret) {
  console.error('APP_PASSWORD and APP_SECRET are required');
  process.exit(1);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

let speaking = false;
const loginFailures = [];

const ttsState = () => (apiKey && activeVoice ? 'configured' : 'missing');

const validVoice = (value) => /^[A-Za-z0-9_-]{8,64}$/.test(String(value || ''));

const readStoredVoice = () => {
  try {
    const stored = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (voiceModels[stored.model]) activeModel = stored.model;
    if (validVoice(stored.voiceId)) activeVoice = stored.voiceId;
  } catch {}
};

const storeVoice = () => {
  const dir = path.dirname(settingsPath);
  mkdirSync(dir, {recursive: true});
  const temp = `${settingsPath}.tmp`;
  writeFileSync(temp, JSON.stringify({model: activeModel, voiceId: activeVoice}), {mode: 0o600});
  renameSync(temp, settingsPath);
};

readStoredVoice();

const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
};

const readSession = (cookieHeader) => {
  const raw = String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('avatar_session='));
  if (!raw) return null;
  const token = raw.slice('avatar_session='.length);
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

const cookie = (token, maxAge) =>
  `avatar_session=${token}; HttpOnly; ${devHttp ? '' : 'Secure; '}SameSite=Lax; Path=/; Max-Age=${maxAge}`;

const send = (response, status, body, headers = {}) => {
  const data = Buffer.from(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...headers,
  });
  response.end(data);
};

const sendJson = (response, status, value, headers) =>
  send(response, status, JSON.stringify(value), headers);

const readBody = (request, limit = 32_000) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > limit) {
      reject(Object.assign(new Error('too large'), {status: 413}));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    const type = String(request.headers['content-type'] || '');
    if (!raw) {
      resolve({});
      return;
    }
    if (type.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(raw);
      resolve({password: params.get('password') || ''});
      return;
    }
    try {
      resolve(JSON.parse(raw));
    } catch {
      reject(Object.assign(new Error('bad json'), {status: 400}));
    }
  });
  request.on('error', reject);
});

const passwordsMatch = (input) => {
  const left = Buffer.from(String(input).trim());
  const right = Buffer.from(password);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
};

const loginAllowed = () => {
  const now = Date.now();
  while (loginFailures.length && loginFailures[0] < now - 10 * 60 * 1000) loginFailures.shift();
  return loginFailures.length < 8;
};

const publicFile = (urlPath) => {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(urlPath, 'http://avatar.local').pathname);
  } catch {
    return null;
  }
  if (pathname === '/') pathname = '/index.html';
  if (pathname.includes('\0') || pathname.includes('..')) return null;
  const file = path.normalize(path.join(publicDir, pathname));
  if (file !== publicDir && !file.startsWith(publicDir + path.sep)) return null;
  return file;
};

const alignmentOf = (payload) => {
  const source = payload?.normalized_alignment?.characters?.length
    ? payload.normalized_alignment
    : payload?.alignment;
  if (!source?.characters?.length) return null;
  const count = Math.min(
    source.characters.length,
    source.character_start_times_seconds?.length || 0,
    source.character_end_times_seconds?.length || 0,
  );
  const characters = [];
  const character_start_times_seconds = [];
  const character_end_times_seconds = [];
  for (let i = 0; i < count; i += 1) {
    const character = String(source.characters[i] ?? '');
    const start = Number(source.character_start_times_seconds[i]);
    const end = Number(source.character_end_times_seconds[i]);
    if (!character || !Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    characters.push(character);
    character_start_times_seconds.push(start);
    character_end_times_seconds.push(end);
  }
  return characters.length ? {characters, character_start_times_seconds, character_end_times_seconds} : null;
};

const synthesize = async (text) => {
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(activeVoice)}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({text, model_id: activeModel}),
    signal: AbortSignal.timeout(45_000),
  });
  if (!upstream.ok) {
    // Provider can return authentication failures as HTTP 400. Inspect structured
    // codes instead of blaming Voice ID/text; never log or expose the raw body.
    const failure = await upstream.json().catch(() => null);
    const error = ttsError(upstream.status, failure);
    console.error(JSON.stringify({event: 'speak.failed', code: error.code, status: upstream.status, text_length: text.length}));
    throw Object.assign(new Error(error.message), {status: 502, body: {error}});
  }
  const payload = JSON.parse(Buffer.from(await upstream.arrayBuffer()).toString('utf8'));
  const audio = Buffer.from(String(payload.audio_base64 || ''), 'base64');
  if (!audio.length || audio.length > 15_000_000) {
    throw Object.assign(new Error('bad audio'), {
      status: 502,
      body: {error: {code: 'TTS_AUDIO_INVALID', message: 'Звук от ElevenLabs пустой или слишком большой.'}},
    });
  }
  return {audio_base64: payload.audio_base64, alignment: alignmentOf(payload), bytes: audio.length};
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://avatar.local');
  try {
    if (url.pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, {ok: true, tts: ttsState()});
      return;
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      const formPost = String(request.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
      const redirect = (location, headers = {}) => {
        response.writeHead(303, {
          location,
          'cache-control': 'no-store',
          'referrer-policy': 'no-referrer',
          ...headers,
        });
        response.end();
      };
      if (!loginAllowed()) {
        if (formPost) {
          redirect('/?login=wait');
          return;
        }
        sendJson(response, 429, {error: {message: 'Слишком много попыток. Подождите десять минут.'}});
        return;
      }
      const body = await readBody(request);
      if (!passwordsMatch(body.password || '')) {
        loginFailures.push(Date.now());
        if (formPost) {
          redirect('/?login=denied');
          return;
        }
        sendJson(response, 401, {error: {message: 'Пароль не подошёл.'}});
        return;
      }
      const token = sign({exp: Date.now() + sessionMs, nonce: randomBytes(8).toString('hex')});
      const sessionCookie = cookie(token, Math.floor(sessionMs / 1000));
      if (formPost) {
        const destination = url.searchParams.get('return');
        const returnTo = destination === 'background-clean' ? '/?layer=background&view=clean' : destination === 'background' ? '/?layer=background' : '/';
        redirect(returnTo, {'set-cookie': sessionCookie});
        return;
      }
      sendJson(response, 200, {ok: true, tts: ttsState()}, {'set-cookie': sessionCookie});
      return;
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      sendJson(response, 200, {ok: true}, {'set-cookie': cookie('', 0)});
      return;
    }

    const session = readSession(request.headers.cookie);
    if (url.pathname === '/api/session' && request.method === 'GET') {
      if (!session) {
        sendJson(response, 401, {ok: false});
        return;
      }
      sendJson(response, 200, {ok: true, tts: ttsState(), model: activeModel, voiceId: activeVoice});
      return;
    }

    if (url.pathname === '/api/background' && ['GET', 'POST'].includes(request.method)) {
      if (!session) return sendJson(response, 401, {error: {message: 'Нужно войти.'}});
      if (request.method === 'GET') return sendJson(response, 200, background.read());
      let settings;
      try { settings = backgroundSettings(await readBody(request)); }
      catch { return sendJson(response, 400, {error: {message: 'Нужны motion true/false и strength от 0 до 100.'}}); }
      try { sendJson(response, 200, background.write(settings)); }
      catch { sendJson(response, 500, {error: {message: 'Настройки фона не записались на диск.'}}); }
      return;
    }

    if (url.pathname === '/api/profiles' && request.method === 'GET') {
      if (!session) return sendJson(response, 401, {error: {message: 'Нужно войти.'}});
      const result = await catalog(publicDir);
      sendJson(response, 200, {...result, settings: await readSettings(profileSettingsPath)});
      return;
    }
    if (url.pathname === '/api/profile-settings' && request.method === 'POST') {
      if (!session) return sendJson(response, 401, {error: {message: 'Нужно войти.'}});
      const body = await readBody(request);
      const {profiles} = await catalog(publicDir);
      if (!profiles.some(p => p.id === body?.id)) return sendJson(response, 400, {error: {message: 'Неизвестный профиль.'}});
      let settings;
      try { settings = settingsOf(body.settings); }
      catch (e) { return sendJson(response, 400, {error: {message: e.message}}); }
      try {
        await saveSettings(profileSettingsPath, body.id, settings);
        sendJson(response, 200, {stored: true, settings});
      } catch { sendJson(response, 500, {error: {message: 'Настройки профиля не записались на диск.'}}); }
      return;
    }

    if (url.pathname === '/api/settings' && request.method === 'POST') {
      if (!session) {
        sendJson(response, 401, {error: {message: 'Нужно войти.'}});
        return;
      }
      const body = await readBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, {error: {message: 'Не понял запрос.'}});
        return;
      }
      const next = {model: activeModel, voiceId: activeVoice};
      if (body.model !== undefined) {
        if (!voiceModels[body.model]) {
          sendJson(response, 400, {error: {message: 'Такой модели нет.'}});
          return;
        }
        next.model = body.model;
      }
      if (body.voiceId !== undefined) {
        const voice = String(body.voiceId || '').trim();
        if (!validVoice(voice)) {
          sendJson(response, 400, {error: {message: 'Нужен ID голоса из букв и цифр.'}});
          return;
        }
        next.voiceId = voice;
      }
      const changed = next.model !== activeModel || next.voiceId !== activeVoice;
      activeModel = next.model;
      activeVoice = next.voiceId;
      let stored = true;
      if (changed) {
        try {
          storeVoice();
        } catch {
          stored = false;
        }
        console.log(JSON.stringify({event: 'tts.updated', model: activeModel, stored}));
      }
      sendJson(response, 200, {ok: true, model: activeModel, voiceId: activeVoice, changed, stored});
      return;
    }

    if (url.pathname === '/api/speak' && request.method === 'POST') {
      if (!session) {
        sendJson(response, 401, {error: {message: 'Нужно войти.'}});
        return;
      }
      if (!apiKey || !activeVoice) {
        sendJson(response, 503, {error: {message: 'Ключ ElevenLabs ещё не задан на сервере.'}});
        return;
      }
      if (speaking) {
        sendJson(response, 409, {error: {message: 'Аватар уже говорит. Дождитесь конца фразы.'}});
        return;
      }
      const body = await readBody(request);
      const text = String(body.text || '').trim();
      if (!text || text.length > maxText) {
        sendJson(response, 400, {error: {message: `Нужен текст короче ${maxText} знаков.`}});
        return;
      }
      speaking = true;
      const started = Date.now();
      try {
        const spoken = await synthesize(text);
        console.log(JSON.stringify({event: 'speak.completed', text_length: text.length, duration_ms: Date.now() - started, bytes: spoken.bytes, letters: spoken.alignment?.characters?.length || 0}));
        sendJson(response, 200, {audio_base64: spoken.audio_base64, alignment: spoken.alignment});
      } finally {
        speaking = false;
      }
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 404, {error: {message: 'Не найдено.'}});
      return;
    }

    const file = publicFile(url.pathname);
    if (!file) {
      sendJson(response, 404, {error: {message: 'Не найдено.'}});
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      sendJson(response, 404, {error: {message: 'Не найдено.'}});
      return;
    }
    if (request.method === 'GET' && url.pathname === '/' && url.searchParams.has('password')) {
      response.writeHead(303, {
        location: '/',
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      });
      response.end();
      return;
    }

    const ext = path.extname(file);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      let html = await readFile(file, 'utf8');
      const notice = url.searchParams.get('login');
      if (notice === 'denied' || notice === 'wait') {
        const message = notice === 'denied'
          ? 'Пароль не подошёл.'
          : 'Слишком много попыток. Подождите десять минут.';
        html = html.replace(
          '<p id="login-error" class="status" role="alert"></p>',
          `<p id="login-error" class="status error" role="alert">${message}</p>`,
        );
      }
      if (session) {
        html = html.replace(/<!-- login:start -->[\s\S]*<!-- login:end -->/, '');
        html = html.replace('<section id="studio" hidden>', '<section id="studio">');
      }
      const page = Buffer.from(html);
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': page.length,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy': "default-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' blob:; media-src 'self' blob:; worker-src 'self' blob:",
      });
      response.end(page);
      return;
    }
    response.writeHead(200, {
      'content-type': types[ext] || 'application/octet-stream',
      'content-length': info.size,
      'cache-control': ext === '.png' ? 'public, max-age=3600' : 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' blob:; media-src 'self' blob:; worker-src 'self' blob:",
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(file).pipe(response);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : (error.status || 500);
    if (status >= 500) console.error(JSON.stringify({event: 'request.failed', status, name: error.name, code: error.code || ''}));
    if (!response.headersSent) {
      const message = status === 400 ? 'Не понял запрос.' : status === 404 ? 'Не найдено.' : 'Ошибка сервера.';
      sendJson(response, status, error.body || {error: {message}});
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({event: 'listen', port, tts: ttsState(), login: loginRequired ? 'on' : 'off'}));
});
