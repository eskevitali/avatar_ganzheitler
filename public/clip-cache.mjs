const key='avatar.last-clip.v1';
const ttl=30*60*1000;
export function readClipCache(storage, phrase, voiceIdentity, now=Date.now()) {
  try {
    const record=JSON.parse(storage.getItem(key));
    if(record?.voiceIdentity!==voiceIdentity || record.phrase!==phrase || !Number.isFinite(record.created) || now-record.created<0 || now-record.created>ttl) return null;
    const payload=record.payload;
    if(typeof payload?.audio_base64!=='string' || !payload.audio_base64 || payload.audio_base64.length>20_000_000) return null;
    return payload;
  } catch {return null;}
}
export function writeClipCache(storage, phrase, voiceIdentity, payload, now=Date.now()) {
  try {storage.setItem(key,JSON.stringify({created:now,phrase,voiceIdentity,payload}));} catch {}
}
export function clearClipCache(storage) {try {storage.removeItem(key);} catch {}}
