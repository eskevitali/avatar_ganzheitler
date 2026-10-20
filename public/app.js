const login = document.querySelector('#login');
const studio = document.querySelector('#studio');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const speakForm = document.querySelector('#speak-form');
const text = document.querySelector('#text');
const speakButton = document.querySelector('#speak');
const state = document.querySelector('#state');
const canvas = document.querySelector('#face');
const ctx = canvas.getContext('2d', {alpha: false});

const face = {
  mouthY: 0.635,
  mouthHalfWidth: 0.12,
  maxGap: 42,
  eyes: [
    {x: 0.33, y: 0.385, w: 0.15, h: 0.075},
    {x: 0.52, y: 0.385, w: 0.15, h: 0.075},
  ],
};

const image = new Image();
image.src = '/avatar.png';

let mouth = 0;
let mouthTarget = 0;
let blink = 0;
let nextBlink = performance.now() + 2800;
let audioContext;
let analyser;
let analyserData;
let playing = false;

const setState = (message, isError = false) => {
  state.textContent = message;
  state.classList.toggle('error', isError);
};

const showLogin = () => {
  login.hidden = false;
  studio.hidden = true;
};

const showStudio = (session) => {
  login.hidden = true;
  studio.hidden = false;
  if (session.tts !== 'configured') {
    setState('Ключ ElevenLabs на сервере ещё не задан. Лицо уже можно смотреть.', true);
  } else {
    setState('Покой');
  }
};

const draw = (now) => {
  requestAnimationFrame(draw);
  if (!image.complete || !image.naturalWidth) return;
  const width = canvas.width;
  const height = canvas.height;
  const sway = Math.sin(now / 1800) * 3;
  const tilt = Math.sin(now / 2400) * 0.008;
  if (now > nextBlink) {
    blink = 1;
    nextBlink = now + 2800 + Math.random() * 3200;
  }
  if (blink > 0) blink = Math.max(0, blink - 0.08);

  if (playing && analyser && analyserData) {
    analyser.getByteTimeDomainData(analyserData);
    let sum = 0;
    for (const sample of analyserData) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const level = Math.sqrt(sum / analyserData.length);
    const normalized = Math.min(1, Math.max(0, (level - 0.02) / 0.18));
    mouthTarget = normalized ** 0.75;
  } else {
    mouthTarget = 0;
  }
  const follow = mouthTarget > mouth ? 0.45 : 0.18;
  mouth += (mouthTarget - mouth) * follow;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07080c';
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2 + sway, height / 2);
  ctx.rotate(tilt);
  ctx.translate(-width / 2, -height / 2);

  const split = Math.round(height * face.mouthY);
  const gap = mouth * face.maxGap;
  ctx.drawImage(image, 0, 0, width, split, 0, 0, width, split);
  if (gap > 0.5) {
    const mouthWidth = width * face.mouthHalfWidth * 2;
    ctx.fillStyle = '#140c16';
    ctx.beginPath();
    ctx.ellipse(width / 2, split + gap * 0.45, mouthWidth / 2, Math.max(4, gap * 0.55), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.drawImage(image, 0, split, width, height - split, 0, split + gap, width, height - split);

  if (blink > 0.02) {
    const lid = image;
    for (const eye of face.eyes) {
      const x = eye.x * width;
      const y = eye.y * height;
      const w = eye.w * width;
      const h = eye.h * height;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2 * blink, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(lid, x, y - h * 0.8, w, h, x, y, w, h * blink);
      ctx.restore();
    }
  }
};

image.addEventListener('load', () => {
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
});
requestAnimationFrame(draw);

const readError = async (response) => {
  try {
    const body = await response.json();
    return body.error?.message || 'Не вышло.';
  } catch {
    return 'Не вышло.';
  }
};

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({password: new FormData(loginForm).get('password')}),
  });
  if (!response.ok) {
    loginError.textContent = await readError(response);
    return;
  }
  showStudio(await response.json());
});

document.querySelector('#logout').addEventListener('click', async () => {
  await fetch('/api/logout', {method: 'POST'});
  showLogin();
});

speakForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const phrase = text.value.trim();
  if (!phrase || playing) return;
  speakButton.disabled = true;
  setState('Готовлю голос…');
  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({text: phrase}),
    });
    if (!response.ok) {
      setState(await readError(response), true);
      return;
    }
    const bytes = await response.arrayBuffer();
    audioContext ||= new AudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();
    const decoded = await audioContext.decodeAudioData(bytes.slice(0));
    analyser ||= audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyserData = new Uint8Array(analyser.fftSize);
    const source = audioContext.createBufferSource();
    source.buffer = decoded;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    playing = true;
    setState('Говорит');
    await new Promise((resolve) => {
      source.onended = resolve;
      source.start();
    });
    playing = false;
    setState('Покой');
  } catch (error) {
    playing = false;
    setState(error?.name === 'EncodingError' ? 'Браузер не смог проиграть звук.' : 'Не удалось произнести фразу.', true);
  } finally {
    speakButton.disabled = false;
  }
});

const boot = async () => {
  const response = await fetch('/api/session');
  if (!response.ok) {
    showLogin();
    return;
  }
  showStudio(await response.json());
};

boot();
