import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ttsError} from '../tts-errors.mjs';
test('HTTP 400 key ID error is diagnosed as credentials, never voice/text', () => {
  const error = ttsError(400, {detail: {type: 'authentication_error', code: 'invalid_api_key', status: 'api_key_id_used_as_api_key', message: 'PRIVATE PROVIDER MESSAGE'}});
  assert.equal(error.code, 'TTS_API_KEY_ID');
  assert.match(error.message, /ID/);
  assert.ok(!JSON.stringify(error).includes('PRIVATE'));
});
test('provider codes distinguish authentication, voice and model errors', () => {
  assert.equal(ttsError(400, {detail:{code:'invalid_api_key'}}).code, 'TTS_AUTH_FAILED');
  assert.equal(ttsError(400, {detail:{status:'voice_not_found'}}).code, 'TTS_INVALID_VOICE');
  assert.equal(ttsError(400, {detail:{status:'invalid_model_id'}}).code, 'TTS_INVALID_MODEL');
  assert.equal(ttsError(400).code, 'TTS_INVALID_REQUEST');
  assert.equal(ttsError(422, {detail:[]}).code, 'TTS_INVALID_REQUEST');
  assert.equal(ttsError(401).code, 'TTS_AUTH_FAILED');
  assert.equal(ttsError(429).code, 'TTS_RATE_LIMITED');
  assert.equal(ttsError(502).code, 'TTS_PROVIDER_ERROR');
});
