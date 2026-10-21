// Classify only provider codes; never forward provider messages containing private data.
export const ttsError = (status, payload) => {
  const detail = payload?.detail;
  const codes = [detail?.status, detail?.code];
  if (codes.includes('api_key_id_used_as_api_key')) return {code: 'TTS_API_KEY_ID', message: 'Вместо секретного API-ключа ElevenLabs указан его ID. Замените ELEVENLABS_API_KEY на сам ключ, показанный при создании или перевыпуске.'};
  if (status === 401 || detail?.type === 'authentication_error' || codes.includes('invalid_api_key')) return {code: 'TTS_AUTH_FAILED', message: 'ElevenLabs не принимает API-ключ. Проверьте секретный ключ и его права.'};
  if (codes.some(code => ['voice_not_found', 'invalid_voice_id', 'voice_does_not_exist'].includes(code))) return {code: 'TTS_INVALID_VOICE', message: 'ElevenLabs не находит указанный Voice ID или не разрешает доступ к голосу.'};
  if (codes.some(code => ['model_not_found', 'invalid_model_id'].includes(code))) return {code: 'TTS_INVALID_MODEL', message: 'ElevenLabs не принимает выбранную модель речи.'};
  if (status === 403) return {code: 'TTS_FORBIDDEN', message: 'ElevenLabs запретил запрос. Проверьте права ключа и доступ к голосу.'};
  if (status === 402) return {code: 'TTS_PAYMENT_REQUIRED', message: 'ElevenLabs требует оплату или другой тариф для этого запроса.'};
  if (status === 429) return {code: 'TTS_RATE_LIMITED', message: 'ElevenLabs ограничил запросы или квоту.'};
  if (status === 400 || status === 422) return {code: 'TTS_INVALID_REQUEST', message: 'ElevenLabs отклонил параметры запроса: голос, модель или текст. Точная причина не распознана.'};
  return {code: 'TTS_PROVIDER_ERROR', message: 'ElevenLabs не отдал звук.'};
};
