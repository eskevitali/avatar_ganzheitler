import {lipKeys, speechMouth} from './mouth.mjs';

const login = document.querySelector('#login');
const studio = document.querySelector('#studio');
const speakForm = document.querySelector('#speak-form');
const text = document.querySelector('#text');
const speakButton = document.querySelector('#speak');
const repeatButton = document.querySelector('#repeat');
const state = document.querySelector('#state');
const dollNode = document.querySelector('#doll');

let head = null;
let booting = null;
let playing = false;
let repeatOn = false;
let cachedClip = null;

const setState = (message, isError = false) => {
  state.textContent = message;
  state.classList.toggle('error', isError);
};

const showLogin = () => {
  if (login) login.hidden = false;
  if (studio) studio.hidden = true;
};

const markPressed = (selector, value, attr) => {
  for (const button of document.querySelectorAll(selector)) {
    button.setAttribute('aria-pressed', button.dataset[attr] === value ? 'true' : 'false');
  }
};

const ensureHead = async () => {
  if (head) return head;
  if (booting) return booting;
  booting = (async () => {
    setState('Загружаю куклу…');
    const {TalkingHead} = await import('./vendor/talkinghead.mjs');
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
  if (login) login.hidden = true;
  if (studio) studio.hidden = false;
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

const lipPoses = {
  PP: {viseme_PP: 1, mouthClose: 0.55, jawOpen: 0.02},
  aa: {viseme_aa: 1, jawOpen: 0.85, mouthOpen: 0.45},
  O: {viseme_O: 1, jawOpen: 0.42, mouthFunnel: 0.8, mouthPucker: 0.45},
  I: {viseme_I: 1, jawOpen: 0.16, mouthSmileLeft: 0.7, mouthSmileRight: 0.7, mouthStretchLeft: 0.35, mouthStretchRight: 0.35},
};
const lipLabels = {
  viseme_PP: 'Смыкание М',
  viseme_aa: 'Открытое А',
  viseme_O: 'Круглое О',
  viseme_I: 'Узкое И',
  jawOpen: 'Челюсть',
  mouthClose: 'Закрытие',
  mouthOpen: 'Раскрытие',
  mouthFunnel: 'Воронка',
  mouthPucker: 'Трубочка',
  mouthSmileLeft: 'Улыбка слева',
  mouthSmileRight: 'Улыбка справа',
  mouthStretchLeft: 'Растяжение слева',
  mouthStretchRight: 'Растяжение справа',
};
const lipTune = document.querySelector('#lip-tune');
const lipSliders = document.querySelector('#lip-sliders');
const lipTitle = document.querySelector('#lip-tune-title');
const lipValues = {};
let selectedLip = null;

const lipLetter = (name) => document.querySelector(`[data-viseme="${name}"]`)?.textContent.trim() || '';

const pinMorph = (doll, key, value) => {
  doll.setFixedValue(key, value);
  const entry = doll.mtAvatar?.[key];
  if (!entry || value === null) return;
  const applied = Math.min(entry.max ?? 1, Math.max(entry.min ?? 0, value));
  entry.value = applied;
  entry.applied = applied;
  entry.v = 0;
  if (entry.ms) {
    for (let i = 0; i < entry.ms.length; i += 1) entry.ms[i][entry.is[i]] = applied;
  }
};

const applyLipFixed = (doll, name) => {
  const values = lipValues[name] || {};
  for (const key of lipKeys) pinMorph(doll, key, values[key] ?? 0);
};

const releaseLipFixed = (doll) => {
  if (!doll) return;
  for (const key of lipKeys) doll.setFixedValue(key, null);
};

const setLipLocked = (locked) => {
  for (const input of lipSliders.querySelectorAll('input')) input.disabled = locked;
};

const renderSliders = (name) => {
  lipSliders.replaceChildren();
  for (const [key, value] of Object.entries(lipValues[name])) {
    const row = document.createElement('label');
    row.className = 'slider';
    const caption = document.createElement('span');
    caption.textContent = lipLabels[key] || key;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(Math.round(value * 100));
    input.setAttribute('aria-label', lipLabels[key] || key);
    const output = document.createElement('output');
    output.textContent = input.value;
    input.addEventListener('input', () => {
      if (!head || playing || selectedLip !== name) return;
      const next = Number(input.value) / 100;
      lipValues[name][key] = next;
      output.textContent = input.value;
      pinMorph(head, key, next);
    });
    row.append(caption, input, output);
    lipSliders.append(row);
  }
};

const clearLip = (doll) => {
  selectedLip = null;
  releaseLipFixed(doll || head);
  markPressed('[data-viseme]', '', 'viseme');
  lipTune.hidden = true;
  lipSliders.replaceChildren();
  if (!playing) setState('Покой');
};

const selectLip = async (name) => {
  const doll = await ensureHead();
  if (playing) {
    setState('Губы заняты речью. Остановите повтор.');
    return;
  }
  if (selectedLip === name) {
    clearLip(doll);
    return;
  }
  if (!lipValues[name]) lipValues[name] = {...lipPoses[name]};
  selectedLip = name;
  applyLipFixed(doll, name);
  markPressed('[data-viseme]', name, 'viseme');
  lipTitle.textContent = `Форма «${lipLetter(name)}»`;
  renderSliders(name);
  lipTune.hidden = false;
  setState(`Форма «${lipLetter(name)}»`);
};

for (const button of document.querySelectorAll('[data-viseme]')) {
  button.addEventListener('click', () => selectLip(button.dataset.viseme));
}

document.querySelector('#lip-reset').addEventListener('click', () => clearLip(head));

const readError = async (response) => {
  try {
    const body = await response.json();
    return body.error?.message || 'Не вышло.';
  } catch {
    return 'Не вышло.';
  }
};

document.querySelector('#logout')?.addEventListener('click', async () => {
  await fetch('/api/logout', {method: 'POST'});
  location.assign('/');
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

const lipPoseNow = () => Object.fromEntries(
  Object.entries(lipPoses).map(([name, pose]) => [name, {...pose, ...(lipValues[name] || {})}]),
);

const playClip = async (doll, clip, fromCache) => {
  await doll.audioCtx.resume();
  if (selectedLip) releaseLipFixed(doll);
  const frames = speechMouth(clip.audio, clip.alignment, lipPoseNow());
  doll.speakAudio({
    audio: clip.audio,
    anim: {name: 'blendshapes', dt: frames.dt, vs: frames.vs},
  }, {isRaw: true});
  setState(repeatOn ? 'Повтор' : fromCache ? 'Ещё раз, без генерации' : 'Говорит');
  await waitUntilQuiet(doll, clip.audio.duration * 1000);
};

const loadClip = async (phrase) => {
  if (cachedClip && cachedClip.phrase === phrase) return cachedClip;
  setState('Готовлю голос…');
  const response = await fetch('/api/speak', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({text: phrase}),
  });
  if (!response.ok) {
    setState(await readError(response), true);
    return null;
  }
  const payload = await response.json();
  if (!payload.audio_base64) {
    setState('Сервер не отдал звук.', true);
    return null;
  }
  const binary = atob(payload.audio_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const doll = await ensureHead();
  const audio = await doll.audioCtx.decodeAudioData(bytes.buffer.slice(0));
  cachedClip = {phrase, audio, alignment: payload.alignment || null};
  return cachedClip;
};

const speakPhrase = async (phrase) => {
  if (!phrase || playing) return;
  speakButton.disabled = true;
  playing = true;
  setLipLocked(true);
  try {
    const doll = await ensureHead();
    const fromCache = Boolean(cachedClip && cachedClip.phrase === phrase);
    const clip = await loadClip(phrase);
    if (!clip) return;
    do {
      await playClip(doll, clip, fromCache || repeatOn);
    } while (repeatOn && cachedClip === clip);
  } catch (error) {
    setState(error?.name === 'EncodingError' ? 'Браузер не смог проиграть звук.' : 'Не удалось произнести фразу.', true);
  } finally {
    playing = false;
    speakButton.disabled = false;
    setLipLocked(false);
    if (selectedLip && head) applyLipFixed(head, selectedLip);
    if (!state.classList.contains('error')) setState(selectedLip ? `Форма «${lipLetter(selectedLip)}»` : 'Покой');
  }
};

repeatButton.addEventListener('click', () => {
  if (head?.audioCtx) head.audioCtx.resume();
  repeatOn = !repeatOn;
  repeatButton.setAttribute('aria-pressed', repeatOn ? 'true' : 'false');
  if (!repeatOn) {
    if (!playing) setState('Покой');
    return;
  }
  const phrase = text.value.trim();
  if (cachedClip && (!phrase || cachedClip.phrase === phrase)) {
    speakPhrase(cachedClip.phrase);
    return;
  }
  if (!phrase) {
    setState('Сначала напишите фразу и нажмите «Сказать».');
    return;
  }
  setState('Повтор включён. Новая фраза сгенерируется один раз.');
});

speakForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (head?.audioCtx) head.audioCtx.resume();
  await speakPhrase(text.value.trim());
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
