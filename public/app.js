import { TalkingHead } from './vendor/talkinghead.mjs';

const login = document.querySelector('#login');
const studio = document.querySelector('#studio');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const speakForm = document.querySelector('#speak-form');
const text = document.querySelector('#text');
const speakButton = document.querySelector('#speak');
const state = document.querySelector('#state');
const dollNode = document.querySelector('#doll');

let head = null;
let booting = null;
let playing = false;

const setState = (message, isError = false) => {
  state.textContent = message;
  state.classList.toggle('error', isError);
};

const showLogin = () => {
  login.hidden = false;
  studio.hidden = true;
};

const markPressed = (selector, value, attr) => {
  for (const button of document.querySelectorAll(selector)) {
    button.setAttribute('aria-pressed', button.dataset[attr] === value ? 'true' : 'false');
  }
};

const mouthFrames = (buffer) => {
  const channel = buffer.getChannelData(0);
  const frame = Math.max(1, Math.round(buffer.sampleRate / 30));
  const dt = [];
  const jawOpen = [];
  const mouthFunnel = [];
  const mouthSmile = [];
  for (let i = 0; i < channel.length; i += frame) {
    const end = Math.min(channel.length, i + frame);
    let energy = 0;
    let signChanges = 0;
    let previous = 0;
    for (let j = i; j < end; j += 1) {
      const sample = channel[j];
      energy += sample * sample;
      if (j > i && ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0))) signChanges += 1;
      previous = sample;
    }
    const rms = Math.sqrt(energy / (end - i));
    const open = Math.min(1, Math.max(0, (rms - 0.015) / 0.11)) ** 0.65;
    const bright = signChanges / (end - i);
    dt.push(1000 / 30);
    jawOpen.push(open);
    mouthFunnel.push(open * (bright < 0.08 ? 0.45 : 0.12));
    mouthSmile.push(open * (bright > 0.14 ? 0.35 : 0));
  }
  return {
    dt,
    vs: {
      jawOpen,
      mouthFunnel,
      mouthSmileLeft: mouthSmile,
      mouthSmileRight: mouthSmile,
    },
  };
};

const ensureHead = async () => {
  if (head) return head;
  if (booting) return booting;
  booting = (async () => {
    setState('Загружаю куклу…');
    const doll = new TalkingHead(dollNode, {
      lipsyncModules: ['en'],
      lipsyncLang: 'en',
      cameraView: 'head',
      modelPixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
    await doll.showAvatar({
      url: '/dolls/brunette.glb',
      body: 'F',
      avatarMood: 'neutral',
      lipsyncLang: 'en',
    });
    doll.setView('head');
    head = doll;
    setState('Покой');
    return doll;
  })();
  try {
    return await booting;
  } catch (error) {
    booting = null;
    setState('Кукла не загрузилась.', true);
    throw error;
  }
};

const showStudio = (session) => {
  login.hidden = true;
  studio.hidden = false;
  if (session.tts !== 'configured') setState('Ключ ElevenLabs на сервере ещё не задан. Мимику уже можно смотреть.', true);
  ensureHead().catch(() => {});
};

for (const button of document.querySelectorAll('[data-mood]')) {
  button.addEventListener('click', async () => {
    const doll = await ensureHead();
    doll.setMood(button.dataset.mood);
    markPressed('[data-mood]', button.dataset.mood, 'mood');
    if (!playing) setState(button.textContent);
  });
}

for (const button of document.querySelectorAll('[data-viseme]')) {
  button.addEventListener('click', async () => {
    const doll = await ensureHead();
    if (playing || doll.isSpeaking) return;
    await doll.audioCtx.resume();
    const seconds = 0.45;
    const buffer = doll.audioCtx.createBuffer(1, Math.ceil(doll.audioCtx.sampleRate * seconds), doll.audioCtx.sampleRate);
    doll.speakAudio({
      audio: buffer,
      visemes: [button.dataset.viseme],
      vtimes: [40],
      vdurations: [320],
    }, {isRaw: true});
  });
}

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

const waitUntilQuiet = (doll, duration) => new Promise((resolve) => {
  const timeout = setTimeout(resolve, duration + 1200);
  let heard = false;
  const timer = setInterval(() => {
    if (doll.isSpeaking || doll.isAudioPlaying) heard = true;
    if (heard && !doll.isSpeaking && !doll.isAudioPlaying) {
      clearInterval(timer);
      clearTimeout(timeout);
      resolve();
    }
  }, 80);
});

speakForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const phrase = text.value.trim();
  if (!phrase || playing) return;
  speakButton.disabled = true;
  playing = true;
  setState('Готовлю голос…');
  try {
    const doll = await ensureHead();
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
    await doll.audioCtx.resume();
    const decoded = await doll.audioCtx.decodeAudioData(bytes.slice(0));
    const frames = mouthFrames(decoded);
    doll.speakAudio({
      audio: decoded,
      anim: {name: 'blendshapes', dt: frames.dt, vs: frames.vs},
    }, {isRaw: true});
    setState('Говорит');
    await waitUntilQuiet(doll, decoded.duration * 1000);
    setState('Покой');
  } catch (error) {
    setState(error?.name === 'EncodingError' ? 'Браузер не смог проиграть звук.' : 'Не удалось произнести фразу.', true);
  } finally {
    playing = false;
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
