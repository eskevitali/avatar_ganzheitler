import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const password = process.env.APP_PASSWORD || '';
const secret = process.env.APP_SECRET || '';
const apiKey = process.env.ELEVENLABS_API_KEY || '';
const voiceId = process.env.ELEVENLABS_VOICE_ID || '';
const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
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
  '.mjs': 'text/javascript; charset=utf-8',
};

let speaking = false;
const loginFailures = [];

const ttsState = () => (apiKey && voiceId ? 'configured' : 'missing');

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
  `avatar_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

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

const ttsError = (status) => {
  if (status === 401) return {code: 'TTS_AUTH_FAILED', message: 'ElevenLabs не принимает API-ключ.'};
  if (status === 400 || status === 422) return {code: 'TTS_INVALID_VOICE', message: 'ElevenLabs не принимает Voice ID или текст.'};
  if (status === 429) return {code: 'TTS_RATE_LIMITED', message: 'ElevenLabs ограничил запросы или квоту.'};
  return {code: 'TTS_PROVIDER_ERROR', message: 'ElevenLabs не отдал звук.'};
};

const synthesize = async (text) => {
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      accept: 'audio/mpeg',
      'content-type': 'application/json',
    },
    body: JSON.stringify({text, model_id: modelId}),
    signal: AbortSignal.timeout(45_000),
  });
  if (!upstream.ok) {
    await upstream.body?.cancel();
    const error = ttsError(upstream.status);
    console.error(JSON.stringify({event: 'speak.failed', code: error.code, status: upstream.status, text_length: text.length}));
    throw Object.assign(new Error(error.message), {status: 502, body: {error}});
  }
  const audio = Buffer.from(await upstream.arrayBuffer());
  if (!audio.length || audio.length > 15_000_000) {
    throw Object.assign(new Error('bad audio'), {
      status: 502,
      body: {error: {code: 'TTS_AUDIO_INVALID', message: 'Звук от ElevenLabs пустой или слишком большой.'}},
    });
  }
  return audio;
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
        redirect('/', {'set-cookie': sessionCookie});
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
      sendJson(response, 200, {ok: true, tts: ttsState()});
      return;
    }

    if (url.pathname === '/api/speak' && request.method === 'POST') {
      if (!session) {
        sendJson(response, 401, {error: {message: 'Нужно войти.'}});
        return;
      }
      if (!apiKey || !voiceId) {
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
        const audio = await synthesize(text);
        console.log(JSON.stringify({event: 'speak.completed', text_length: text.length, duration_ms: Date.now() - started, bytes: audio.length}));
        response.writeHead(200, {
          'content-type': 'audio/mpeg',
          'content-length': audio.length,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        response.end(audio);
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
