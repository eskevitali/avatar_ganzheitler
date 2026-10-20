import {createFace, lipShape} from './face.js';

const login = document.querySelector('#login');
const studio = document.querySelector('#studio');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const speakForm = document.querySelector('#speak-form');
const text = document.querySelector('#text');
const speakButton = document.querySelector('#speak');
const state = document.querySelector('#state');
const canvas = document.querySelector('#face');
const mouthSlider = document.querySelector('#mouth');
let face = null;

const expressions = {
  calm: {smile: 0, sad: 0, surprise: 0, stern: 0},
  smile: {smile: 1, sad: 0, surprise: 0, stern: 0},
  sad: {smile: 0, sad: 1, surprise: 0, stern: 0},
  surprise: {smile: 0, sad: 0, surprise: 1, stern: 0},
  stern: {smile: 0, sad: 0, surprise: 0, stern: 1},
};

let expression = 'calm';
let lip = 'auto';
let manualOpen = 0;
let audioOpen = 0;
let audioRound = 0.25;
let audioContext;
let analyser;
let wave;
let spectrum;
let playing = false;

const image = new Image();
image.src = '/avatar.png';
image.addEventListener('load', () => {
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  try {
    face = createFace(canvas);
    face?.setImage(image);
  } catch (error) {
    console.error(error);
    setState('Лицо не собралось в этом браузере.', true);
  }
});

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
  if (!face) {
    setState('В этом браузере нет WebGL, лицо показано без мимики.', true);
    return;
  }
  if (session.tts !== 'configured') setState('Ключ ElevenLabs на сервере ещё не задан. Мимику уже можно смотреть.', true);
  else setState('Покой');
};

const markPressed = (selector, value, attr) => {
  for (const button of document.querySelectorAll(selector)) {
    button.setAttribute('aria-pressed', button.dataset[attr] === value ? 'true' : 'false');
  }
};

const readVoice = () => {
  if (!playing || !analyser) return;
  analyser.getByteTimeDomainData(wave);
  let energy = 0;
  for (const sample of wave) {
    const centered = (sample - 128) / 128;
    energy += centered * centered;
  }
  const level = Math.sqrt(energy / wave.length);
  audioOpen = Math.min(1, Math.max(0, (level - 0.015) / 0.16)) ** 0.7;
  analyser.getByteFrequencyData(spectrum);
  let weight = 0;
  let mass = 0;
  for (let i = 0; i < spectrum.length; i += 1) {
    weight += i * spectrum[i];
    mass += spectrum[i];
  }
  const centroid = mass ? weight / mass / spectrum.length : 0.4;
  audioRound = Math.min(1, Math.max(0, (0.55 - centroid) / 0.4));
};

const frame = (now) => {
  readVoice();
  const mood = expressions[expression];
  const shaped = lip === 'auto' ? null : lip === 'custom' ? {open: manualOpen, round: manualOpen > 0.55 ? 0.25 : 0.65} : lipShape[lip];
  let open = shaped ? Math.min(1, shaped.open + audioOpen * 0.3) : audioOpen;
  let round = shaped ? shaped.round : audioRound;
  if (expression === 'surprise') {
    open = Math.max(open, 0.62);
    round = Math.max(round, 0.8);
  }
  if (expression === 'smile') open = Math.max(open, 0.18);
  face?.setTarget({...mood, open, round});
  face?.frame(now);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

for (const button of document.querySelectorAll('[data-expression]')) {
  button.addEventListener('click', () => {
    expression = button.dataset.expression;
    markPressed('[data-expression]', expression, 'expression');
    if (!playing) setState(button.textContent);
  });
}

for (const button of document.querySelectorAll('[data-lip]')) {
  button.addEventListener('click', () => {
    lip = button.dataset.lip;
    markPressed('[data-lip]', lip, 'lip');
    if (lip !== 'auto') {
      manualOpen = lipShape[lip].open;
      mouthSlider.value = String(Math.round(manualOpen * 100));
    }
  });
}

mouthSlider.addEventListener('input', () => {
  lip = 'custom';
  manualOpen = Number(mouthSlider.value) / 100;
  markPressed('[data-lip]', lip, 'lip');
});

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
    wave = new Uint8Array(analyser.fftSize);
    spectrum = new Uint8Array(analyser.frequencyBinCount);
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
    audioOpen = 0;
    setState('Покой');
  } catch (error) {
    playing = false;
    audioOpen = 0;
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
