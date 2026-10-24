import {lipKeys, speechMouth} from './mouth.mjs';
import {startBackground} from './background.mjs';
const compositeClean = new URLSearchParams(location.search).get('scene') === '1';
if (compositeClean) document.body.classList.add('composite-clean');
const params = new URLSearchParams(location.search);
const suppliedChannel = params.get('channel');
let storedSceneKey;
try { if (!compositeClean) storedSceneKey=sessionStorage.getItem('avatar.scene-channel.v1'); } catch {}
const validSceneKey=value=>typeof value==='string' && /^[a-zA-Z0-9-]{1,64}$/.test(value);
const sceneKey = validSceneKey(suppliedChannel) ? suppliedChannel : validSceneKey(storedSceneKey) ? storedSceneKey : Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
try { if (!compositeClean) sessionStorage.setItem('avatar.scene-channel.v1',sceneKey); } catch {}
const sceneChannel = 'BroadcastChannel' in window ? new BroadcastChannel(`avatar-scene:${sceneKey}`) : null;
const backgroundOnly = new URLSearchParams(location.search).get('layer') === 'background';
if (compositeClean) {
  const form = document.querySelector('#login-form');
  if (form) form.action='/api/login?return=composite';
}
const backgroundClean = backgroundOnly && new URLSearchParams(location.search).get('view') === 'clean';
if (backgroundOnly) {
  document.body.classList.add('background-only');
  if (backgroundClean) document.body.classList.add('background-clean');
  const loginForm = document.querySelector('#login-form');
  if (loginForm) loginForm.action = `/api/login?return=${backgroundClean ? 'background-clean' : 'background'}`;
}
import {lipPoses, settingsOf, visualsOf, moods} from './profiles.mjs';
import {attachFilaments} from './filaments.mjs';
import {attachReferenceMask} from './reference-mask.mjs';
import {attachUserMask} from './user-mask.mjs';
import {readClipCache, writeClipCache, clearClipCache} from './clip-cache.mjs';

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
let voiceIdentity = '';

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

const compositeStage = document.querySelector('#composite-stage');
let compositeBackground = null;
let phaseTimer;
const facePhase = phase => {
  clearTimeout(phaseTimer);
  const formed = !['waiting', 'preparing', 'dissolving'].includes(phase);
  compositeStage.dataset.facePhase = phase;
  head?.filaments?.reveal(formed ? 1 : 0);
  document.querySelector('#face-phase').textContent = ({preview:'Лицо сформировано', waiting:'Ожидание', preparing:'Готовлю аудио · лицо не сформировано', forming:'Лицо формируется', speaking:'Говорит', settling:'Покой · сияние успокаивается', dissolving:'Лицо растворяется'})[phase];
  document.querySelector('#form-face').setAttribute('aria-pressed', String(formed));
  document.querySelector('#dissolve-face').setAttribute('aria-pressed', String(!formed));
  publishScene();
};
document.querySelector('#form-face').addEventListener('click', () => { facePhase('preview'); setState('Формирование лица. Текст не требуется.'); });
document.querySelector('#dissolve-face').addEventListener('click', () => { facePhase('dissolving'); setState('Растворение лица. Текст не требуется.'); });

const profileSelect = document.querySelector('#profile');
const saveProfileButton = document.querySelector('#save-profile');
let profiles = [];
let profileSettings = {};
let activeProfile = null;
let currentMood = 'neutral';
let faceVisuals = null;
let switching = false;

const profileSnapshot = () => ({mood:currentMood, lips:structuredClone(lipValues), ...(faceVisuals ? {visuals:{...faceVisuals}} : {})});
const syncVisualInputs = () => {
  if (!faceVisuals) return;
  for (const key of ['opacity','brightness','speed','activityStrength','headMotion','eyeMotion','emotionStrength']) {
    const isMotion=['headMotion','eyeMotion','emotionStrength'].includes(key);
    const enabled=isMotion?activeProfile?.id==='user-mask':key!=='activityStrength'||Boolean(activeProfile?.appearance?.activity);
    document.querySelector('#face-motion-controls').hidden=activeProfile?.id!=='user-mask';
    document.querySelector(`#face-${key}`).closest('label').hidden=!enabled;
    if(!enabled)continue;
    document.querySelector(`#face-${key}`).value=String(Math.round(faceVisuals[key]*100));
    document.querySelector(`#face-${key}-value`).textContent=`${Math.round(faceVisuals[key]*100)}%`;
  }
};
for (const key of ['opacity','brightness','speed','activityStrength','headMotion','eyeMotion','emotionStrength']) document.querySelector(`#face-${key}`).addEventListener('input', event => {
  if (!head?.filaments || switching) return;
  faceVisuals=head.filaments.tune({[key]:Number(event.target.value)/100});
  if(['headMotion','eyeMotion','emotionStrength'].includes(key))saveMotionSoon();
  syncVisualInputs(); if (!playing) facePhase('preview'); else publishScene();
});

const readMotion = id => {
  try {const value=JSON.parse(localStorage.getItem(`avatar.motion.v1.${id}`));if(value&&['headMotion','eyeMotion','emotionStrength'].every(k=>typeof value[k]==='number'&&Number.isFinite(value[k])&&value[k]>=0&&value[k]<=3))return {...value,emotionStrength:typeof value.emotionStrength==='number'&&value.emotionStrength>=0&&value.emotionStrength<=2?value.emotionStrength:1};}catch{}return {};
};
let motionSaveTimer,motionSaveChain=Promise.resolve();
function saveMotionSoon(){
  const selectedMood=currentMood,profile=activeProfile,id=profile.id,motion={headMotion:faceVisuals.headMotion,eyeMotion:faceVisuals.eyeMotion,emotionStrength:faceVisuals.emotionStrength};
  try{localStorage.setItem(`avatar.motion.v1.${id}`,JSON.stringify(motion));}catch{}
  const status=document.querySelector('#face-motion-save');status.textContent='Сохраняю параметры…';
  clearTimeout(motionSaveTimer);motionSaveTimer=setTimeout(()=>{
    const prior=profileSettings[id]||profile.defaults;
    const settings=settingsOf({...prior,mood:selectedMood,visuals:{...visualsOf({...profile.appearance,...prior.visuals}),...motion}});
    motionSaveChain=motionSaveChain.catch(()=>{}).then(async()=>{
      try{const response=await fetch('/api/profile-settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,settings})});if(!response.ok)throw new Error();profileSettings[id]=(await response.json()).settings;if(activeProfile?.id===id)status.textContent='Параметры сохранены для этой маски.';}
      catch{if(activeProfile?.id===id)status.textContent='Параметры сохранены в этом браузере; сервер сейчас недоступен.';}
    });
  },350);
}

const disposeHead = (doll) => {
  if (!doll) return;
  const node = doll.nodeAvatar;
  doll.filaments?.dispose();
  try { doll.dispose(); }
  finally {
    doll.audioCtx?.close().catch(() => {});
    node?.remove();
  }
};
const switchProfile = async (id) => {
  if (playing || switching) return;
  const profile = profiles.find(p => p.id === id);
  if (!profile || (activeProfile?.id === id && head)) return;
  switching = true;
  profileSelect.disabled = true;
  saveProfileButton.disabled = true;
  setState('Загружаю профиль…');
  let candidate;
  const node = document.createElement('div');
  node.className = 'avatar-layer';
  node.style.visibility = 'hidden';
  dollNode.append(node);
  try {
    const settings = settingsOf(profileSettings[id] || profile.defaults);
    if(id==='user-mask')settings.visuals=visualsOf({...profile.appearance,...settings.visuals,...readMotion(id)});
    const {TalkingHead} = await import('./vendor/talkinghead.mjs');
    candidate = new TalkingHead(node, {
      lipsyncModules: ['en'], lipsyncLang: 'en', cameraView: profile.cameraView,
      modelPixelRatio: profile.appearance ? Math.min(1, 1 / (window.devicePixelRatio || 1)) : Math.min(window.devicePixelRatio || 1, 2),
    });
    await candidate.showAvatar({url: profile.url, body: profile.body, avatarMood: settings.mood, lipsyncLang: 'en'});
    candidate.setView(profile.cameraView);
    if (profile.appearance?.style === 'user-mask') candidate.filaments = attachUserMask(candidate, {...profile.appearance, ...settings.visuals, motionSeed:sceneKey,mood:settings.mood});
    else if (profile.appearance?.style === 'reference-mask') candidate.filaments = attachReferenceMask(candidate, {...profile.appearance, ...settings.visuals});
    else if (profile.appearance) candidate.filaments = attachFilaments(candidate, {...profile.appearance, ...settings.visuals});
    // Commit only after loading succeeds; a failed candidate leaves the old doll usable.
    if (activeProfile) profileSettings[activeProfile.id] = profileSnapshot();
    disposeHead(head);
    head = candidate;
    node.dataset.modelUrl=profile.url;
    compositeStage.dataset.loadedProfileId=profile.id;
    activeProfile = profile;
    document.querySelector('#clean-scene-link').href=`/?scene=1&view=clean&profile=${encodeURIComponent(id)}&channel=${sceneKey}`;
    try { localStorage.setItem('avatar.profile', id); } catch {}
    const isFilament = Boolean(profile.appearance);
    compositeStage.classList.toggle('has-filaments', isFilament);
    document.body.classList.toggle('filament-mode', isFilament);
    document.querySelector('#face-controls').hidden = !isFilament;
    document.querySelector('#composite-background').hidden = !isFilament;
    if (isFilament && !compositeBackground) compositeBackground = startBackground(document.querySelector('#composite-background'), {clean:true});
    currentMood = settings.mood;
    faceVisuals = profile.appearance ? visualsOf({...profile.appearance, ...settings.visuals, activityStrength:settings.visuals?.activityStrength ?? profile.appearance.activity?.strength}) : null;
    syncVisualInputs();
    for (const key of Object.keys(lipValues)) delete lipValues[key];
    Object.assign(lipValues, settings.lips);
    clearLip(head);
    markPressed('[data-mood]', currentMood, 'mood');
    profileSelect.value = id;
    node.style.visibility = '';
    facePhase('preview');
    setState(profile.name);
  } catch (error) {
    try { disposeHead(candidate); } catch (cleanupError) { console.error('Profile cleanup failed', cleanupError); }
    node.remove();
    profileSelect.value = activeProfile?.id || '';
    setState(`Профиль не загрузился: ${error.message}`, true);
    throw error;
  } finally {
    switching = false;
    profileSelect.disabled = false;
    saveProfileButton.disabled = !head;
  }
};
const ensureHead = async () => {
  if (booting) await booting;
  if (switching) throw new Error('Дождитесь загрузки профиля');
  if (head) return head;
  throw new Error('Выберите доступный профиль');
};
profileSelect.addEventListener('change', () => {
  booting = switchProfile(profileSelect.value);
  booting.catch(() => {}).finally(() => { booting = null; });
});
saveProfileButton.addEventListener('click', async () => {
  if (!activeProfile || switching) return;
  const id = activeProfile.id;
  const settings = profileSnapshot();
  saveProfileButton.disabled = true;
  try {
    const response = await fetch('/api/profile-settings', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({id, settings})});
    if (!response.ok) throw new Error(await readError(response));
    profileSettings[id] = (await response.json()).settings;
    setState('Настройки профиля сохранены.');
  } catch (error) { setState(error.message, true); }
  finally { saveProfileButton.disabled = switching || !head; }
});
const loadProfiles = async () => {
  const response = await fetch('/api/profiles');
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json();
  profiles = result.profiles;
  profileSettings = result.settings;
  profileSelect.replaceChildren(...profiles.map(profile => {
    const option = document.createElement('option');
    option.value = profile.id; option.textContent = profile.name;
    return option;
  }));
  let lastProfile;
  try { lastProfile = localStorage.getItem('avatar.profile'); } catch {}
  const desired=compositeClean?(params.get('profile')||'user-mask'):lastProfile;
  const initial=profiles.find(p=>p.id===desired)||profiles.find(p=>p.id==='user-mask')||profiles[0];
  if(!initial)throw new Error('Нет установленных профилей. Установите assets/user-mask.');
  await switchProfile(initial.id);
  if (compositeClean) sceneChannel?.postMessage({kind:'ready'});
  document.querySelector('#profile-errors').textContent = result.errors.map(e => `${e.id}: ${e.message}`).join('\n');
};

// Preview-only scene link: share bounded visual state/poses within this browser.
// It contains no voice credentials, audio data, provider requests or external transport.
function publishScene() {
  if (compositeClean || !activeProfile) return;
  sceneChannel?.postMessage({kind:'settings', profileId:activeProfile.id, settings:profileSnapshot(), selectedLip, phase:compositeStage.dataset.facePhase});
}
let sceneApplying = false;
if (sceneChannel) sceneChannel.onmessage = async event => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (!compositeClean) { if (message.kind === 'ready') publishScene(); return; }
  if (!head || switching) return;
  if (message.kind === 'pose' && !sceneApplying) {
    for (const key of lipKeys) {
      const value=message.values?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) pinMorph(head,key,Math.min(1,Math.max(0,value)));
    }
    head.filaments?.react(message.audioLevel, true);
    compositeStage.dataset.liveJaw=String(Math.round((message.values?.jawOpen || 0)*1000)/1000);
    compositeStage.dataset.poseFrames=String(Number(compositeStage.dataset.poseFrames || 0)+1);
    return;
  }
  if (message.kind === 'pose-end') {
    head.filaments?.react(0,false);
    releaseLipFixed(head); if (selectedLip) applyLipFixed(head,selectedLip); return;
  }
  if (message.kind !== 'settings' || sceneApplying) return;
  sceneApplying = true;
  try {
    const next=settingsOf(message.settings);
    const profile=profiles.find(p=>p.id===message.profileId);
    if(!profile) return;
    if(activeProfile?.id!==profile.id) await switchProfile(profile.id);
    currentMood=next.mood; applyMood(head,currentMood);
    for(const key of Object.keys(lipValues)) delete lipValues[key];
    Object.assign(lipValues,next.lips);
    if(head.filaments) {faceVisuals=head.filaments.tune(next.visuals || profile.appearance);syncVisualInputs();}
    selectedLip=Object.hasOwn(lipPoses,message.selectedLip) ? message.selectedLip : null;
    compositeStage.dataset.previewPose=selectedLip || '';
    releaseLipFixed(head);if(selectedLip)applyLipFixed(head,selectedLip);
    const phase=['preview','waiting','preparing','forming','speaking','settling','dissolving'].includes(message.phase)?message.phase:'preview';
    facePhase(phase);
  } catch { setState('Не удалось применить параметры общего вида.',true); }
  finally { sceneApplying=false; }
};
let wasSharingPose=false;
if (!compositeClean) setInterval(()=>{
  if(head && (head.isSpeaking || head.isAudioPlaying) && activeProfile?.appearance) {
    const values=Object.fromEntries(lipKeys.map(k=>[k,head.mtAvatar?.[k]?.applied ?? 0]));
    sceneChannel?.postMessage({kind:'pose',values,audioLevel:head.filaments?.audioLevel || 0}); wasSharingPose=true;
  } else if(wasSharingPose) {
    wasSharingPose=false;sceneChannel?.postMessage({kind:'pose-end'});publishScene();
  }
},40);

const voiceInput = document.querySelector('#voice-id');

const applyVoiceSettings = (settings) => {
  const nextIdentity=JSON.stringify([settings.model,settings.voiceId]);
  if(voiceIdentity && voiceIdentity!==nextIdentity) {cachedClip=null;clearClipCache(sessionStorage);}
  voiceIdentity=nextIdentity;
  if (typeof settings.voiceId === 'string') voiceInput.value = settings.voiceId;
  if (settings.model) markPressed('[data-model]', settings.model, 'model');
};

const saveVoice = async (patch) => {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    setState(await readError(response), true);
    return;
  }
  const settings = await response.json();
  applyVoiceSettings(settings);
  if (settings.changed) cachedClip = null;
  if (playing) return;
  if (!settings.changed) {
    setState('Уже так и стоит.');
    return;
  }
  setState(settings.stored
    ? 'Голос сохранён. Следующая фраза сгенерируется заново.'
    : 'Голос принят до перезапуска. На диск не записался.', !settings.stored);
};

const showStudio = (session) => {
  if (login) login.hidden = true;
  if (studio) studio.hidden = false;
  applyVoiceSettings(session);
  if (backgroundOnly) {
    const demo = document.querySelector('#background-demo');
    demo.hidden = false;
    startBackground(demo, {clean: backgroundClean});
    return;
  }
  if (session.tts !== 'configured') setState('Ключ ElevenLabs на сервере ещё не задан. Мимику уже можно смотреть.', true);
  booting = loadProfiles();
  booting.catch(error => setState(error.message, true)).finally(() => { booting = null; });
};

for (const button of document.querySelectorAll('[data-model]')) {
  button.addEventListener('click', () => saveVoice({model: button.dataset.model}));
}

document.querySelector('#save-voice').addEventListener('click', () => {
  saveVoice({voiceId: voiceInput.value.trim()});
});

// Bounded entry point for a future dialogue controller; no generation here.
export async function setDialogueMood({mood,intensity=1}={}){
  if(!moods.includes(mood))throw new Error('Неизвестная эмоция');
  if(typeof intensity!=='number'||!Number.isFinite(intensity)||intensity<0||intensity>2)throw new Error('Сила эмоции должна быть от 0 до 2');
  const doll=await ensureHead();if(activeProfile?.id!=='user-mask')throw new Error('Выберите вашу маску');
  currentMood=mood;faceVisuals=doll.filaments.tune({emotionStrength:intensity});applyMood(doll,mood);
  markPressed('[data-mood]',mood,'mood');syncVisualInputs();saveMotionSoon();
  if(!playing)facePhase('preview');else publishScene();return {mood,intensity};
}
function applyMood(doll,mood){if(doll.filaments?.setEmotion){if(doll.moodName!=='neutral')doll.setMood('neutral');doll.filaments.setEmotion(mood);}else doll.setMood(mood);}
for (const button of document.querySelectorAll('[data-mood]')) {
  button.addEventListener('click', async () => {
    if (switching || !head) return;
    const doll = await ensureHead();
    if(activeProfile?.id==='user-mask'){await setDialogueMood({mood:button.dataset.mood,intensity:faceVisuals.emotionStrength});if(!playing)setState(button.textContent);return;}
    applyMood(doll,button.dataset.mood);
    if (!playing) facePhase('preview');
    currentMood = button.dataset.mood;
    if(activeProfile?.id==='user-mask')saveMotionSoon();
    publishScene();
    markPressed('[data-mood]', button.dataset.mood, 'mood');
    if (!playing) setState(button.textContent);
  });
}

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
      if (!head || playing || switching || selectedLip !== name) return;
      const next = Number(input.value) / 100;
      lipValues[name][key] = next;
      output.textContent = input.value;
      pinMorph(head, key, next);
      publishScene();
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
  publishScene();
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
  facePhase('preview');
  if (!lipValues[name]) lipValues[name] = {...lipPoses[name]};
  selectedLip = name;
  applyLipFixed(doll, name);
  markPressed('[data-viseme]', name, 'viseme');
  lipTitle.textContent = `Форма «${lipLetter(name)}»`;
  renderSliders(name);
  lipTune.hidden = false;
  setState(`Форма «${lipLetter(name)}»`);
  publishScene();
};

for (const button of document.querySelectorAll('[data-viseme]')) {
  button.addEventListener('click', () => selectLip(button.dataset.viseme).catch(error => setState(error.message, true)));
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
  clearClipCache(sessionStorage);
  await fetch('/api/logout', {method: 'POST'});
  location.assign('/');
});

const waitUntilQuiet = (doll, duration) => new Promise((resolve) => {
  const timeout = setTimeout(() => { clearInterval(timer); resolve(); }, duration + 1200);
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
  if (doll.filaments) {
    facePhase('forming');
    await new Promise(resolve => setTimeout(resolve, doll.filaments?.formationLeadMs ?? 650));
    facePhase('speaking');
  }
  doll.speakAudio({
    audio: clip.audio,
    anim: {name: 'blendshapes', dt: frames.dt, vs: frames.vs},
  }, {isRaw: true});
  setState(repeatOn ? 'Повтор' : fromCache ? 'Ещё раз, без генерации' : 'Говорит');
  await waitUntilQuiet(doll, clip.audio.duration * 1000);
};

const loadClip = async (phrase) => {
  if (cachedClip && cachedClip.phrase === phrase) return cachedClip;
  let payload=readClipCache(sessionStorage,phrase,voiceIdentity);
  const restored=Boolean(payload);
  if(!payload) {
    setState('Готовлю голос…');
    if (head?.filaments) facePhase('preparing');
    speakForm.dataset.ttsRequests=String(Number(speakForm.dataset.ttsRequests || 0)+1);
    const response = await fetch('/api/speak', {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({text: phrase}),
    });
    if (!response.ok) { setState(await readError(response), true); return null; }
    payload = await response.json();
    writeClipCache(sessionStorage,phrase,voiceIdentity,payload);
  }
  if (!payload.audio_base64) {
    setState('Сервер не отдал звук.', true);
    return null;
  }
  const binary = atob(payload.audio_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const doll = await ensureHead();
  const audio = await doll.audioCtx.decodeAudioData(bytes.buffer.slice(0));
  cachedClip = {phrase, audio, alignment: payload.alignment || null, restored};
  return cachedClip;
};

const speakPhrase = async (phrase) => {
  if (!phrase || playing || switching) return;
  speakButton.disabled = true;
  playing = true;
  profileSelect.disabled = true;
  setLipLocked(true);
  try {
    const doll = await ensureHead();
    const fromCache = Boolean(cachedClip && cachedClip.phrase === phrase);
    const clip = await loadClip(phrase);
    if (!clip) return;
    do {
      await playClip(doll, clip, fromCache || clip.restored || repeatOn);
    } while (repeatOn && cachedClip === clip);
  } catch (error) {
    setState(error?.name === 'EncodingError' ? 'Браузер не смог проиграть звук.' : 'Не удалось произнести фразу.', true);
  } finally {
    playing = false;
    profileSelect.disabled = false;
    speakButton.disabled = false;
    setLipLocked(false);
    if (selectedLip && head) applyLipFixed(head, selectedLip);
    if (head?.filaments) {
      facePhase('settling');
      phaseTimer=setTimeout(()=>{facePhase('dissolving');phaseTimer=setTimeout(()=>facePhase('waiting'),head?.filaments?.transitionMs ?? 1500);},2500);
    }
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
