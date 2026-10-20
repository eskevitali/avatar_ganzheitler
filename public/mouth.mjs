export const lipKeys = ['viseme_PP', 'viseme_aa', 'viseme_O', 'viseme_I', 'jawOpen', 'mouthClose', 'mouthOpen', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight'];

const clamp01 = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
};

export const poseForLetter = (letter) => {
  const value = String(letter ?? '').toLowerCase();
  if (value.length !== 1) return null;
  if ('аaя'.includes(value)) return 'aa';
  if ('оoёуuю'.includes(value)) return 'O';
  if ('иiыэеeй'.includes(value)) return 'I';
  if ('мmбbпp'.includes(value)) return 'PP';
  return null;
};

const poseVector = (poses, name) => {
  const source = name ? poses?.[name] || {} : {};
  return Object.fromEntries(lipKeys.map((key) => [key, name ? clamp01(source[key]) : 0]));
};

const pushPoint = (dt, vs, ms, vector) => {
  if (vs[lipKeys[0]].length === 0) {
    for (const key of lipKeys) vs[key].push(vector[key]);
    return;
  }
  dt.push(Math.max(1, Math.round(ms)));
  for (const key of lipKeys) vs[key].push(vector[key]);
};

const lipMarks = (alignment, duration) => {
  const characters = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!characters || !starts || !ends) return [];
  const count = Math.min(characters.length, starts.length, ends.length);
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const pose = poseForLetter(characters[i]);
    const t0 = Number(starts[i]);
    const t1 = Number(ends[i]);
    if (!pose || !Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0 || t0 >= duration) continue;
    marks.push({t0, t1: Math.min(duration, t1), pose});
  }
  return marks;
};

const segmentsFor = (alignment, duration) => {
  const safeDuration = Math.max(0.05, duration || 0);
  const marks = lipMarks(alignment, safeDuration);
  if (!marks.length) return [];
  const segments = [];
  let cursor = 0;
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    const next = marks[i + 1];
    const start = Math.min(safeDuration, Math.max(cursor, mark.t0));
    if (start > cursor + 0.015) {
      segments.push({t0: cursor, t1: start, pose: null});
      cursor = start;
    }
    let end = mark.t1;
    if (next && next.t0 - mark.t1 <= 0.16) end = next.t0;
    end = Math.min(safeDuration, Math.max(cursor + 0.04, end));
    if (end <= cursor) continue;
    segments.push({t0: cursor, t1: end, pose: mark.pose});
    cursor = end;
  }
  if (safeDuration > cursor + 0.015) segments.push({t0: cursor, t1: safeDuration, pose: null});
  return segments;
};

const tracksFromSegments = (segments, poses) => {
  const dt = [];
  const vs = Object.fromEntries(lipKeys.map((key) => [key, []]));
  pushPoint(dt, vs, 0, poseVector(poses, null));
  for (const segment of segments) {
    const ms = (segment.t1 - segment.t0) * 1000;
    const blend = Math.min(45, ms * 0.4);
    pushPoint(dt, vs, blend, poseVector(poses, segment.pose));
    if (ms - blend > 1) pushPoint(dt, vs, ms - blend, poseVector(poses, segment.pose));
  }
  return {dt, vs};
};

const goertzel = (samples, rate, freq) => {
  const coeff = 2 * Math.cos((2 * Math.PI * freq) / rate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
};

const audioTracks = (audio, poses) => {
  const channel = audio.getChannelData(0);
  const frame = Math.max(1, Math.round(audio.sampleRate / 30));
  const dt = [];
  const vs = Object.fromEntries(lipKeys.map((key) => [key, []]));
  const smooth = poseVector(poses, null);
  pushPoint(dt, vs, 0, smooth);
  for (let i = 0; i < channel.length; i += frame) {
    const end = Math.min(channel.length, i + frame);
    let energy = 0;
    for (let j = i; j < end; j += 1) energy += channel[j] * channel[j];
    const rms = Math.sqrt(energy / (end - i));
    const gain = Math.min(1, Math.max(0, (rms - 0.012) / 0.04));
    let pose = null;
    if (gain > 0) {
      const slice = channel.subarray(i, end);
      const low = goertzel(slice, audio.sampleRate, 280);
      const mid = goertzel(slice, audio.sampleRate, 900);
      const high = goertzel(slice, audio.sampleRate, 2800);
      pose = high > low && high > mid ? 'I' : low > mid ? 'O' : 'aa';
      if (gain < 0.35) pose = 'PP';
    }
    const target = poseVector(poses, pose);
    for (const key of lipKeys) smooth[key] = smooth[key] * 0.3 + target[key] * gain * 0.7;
    pushPoint(dt, vs, 1000 / 30, {...smooth});
  }
  return {dt, vs};
};

export const speechMouth = (audio, alignment, poses) => {
  const segments = segmentsFor(alignment, audio?.duration || 0);
  if (segments.length) return tracksFromSegments(segments, poses);
  return audioTracks(audio, poses);
};
