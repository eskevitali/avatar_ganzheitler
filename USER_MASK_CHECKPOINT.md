# Accepted user mask — 2026-10-24

User accepted the local blink/UV correction on 2026-10-24. Profile: `user-mask`, model `user-mask-49c38f1fa339.glb`. Do not rebuild from reference002 or older procedural faces.

## Authoritative sources

- Untouched user-authored source: assets/user-mask/source/user-accepted-2026-10-23.blend; exact original/texture hashes in source/checkpoint.json.
- Separate editable adaptation: blender/user-mask/mask_user_adaptation.blend.
- User original blender/002/mask_002_working.blend and user backups003/004 remain untouched and unstaged.
- Earlier accepted browser asset preserved in assets/user-mask/approved-before-edge/.

## Correction and evidence

Original blink influenced 26 bridge vertices per eye, including opposite-side vertices, up to7.14mm. Corrected targets are restricted to their own eye; bridge/opposite side/brows/nose outside local eye zone have zero displacement. Upper lids close in front of separate globe surfaces. No retopology or opacity-based eye hiding.

The accepted reference projection placed the photo irises roughly5% of image height below the globe centers, leaving duplicate eyes on lid/cheek skin. Local eye UV alignment now places irises on globe surfaces and skin on lids. Original PNG bytes unchanged. Neutral geometry outside AND inside eyes is unchanged; only local UV and two blink targets differ.

scripts/check-user-mask-regression.py verifies exact GLB position/normal/triangle/embedded-image equality and all66 non-blink targets unchanged (68 total). Blender locality assertions in fix_blink_closure.py. Reports: blender/user-mask/glb-regression-report.json and blink-correction-report.json. Open/.5/closed/left/right and Solid half/closed images in blender/user-mask/previews/.

Renderer: sparse spatial boundary threads, geodesic edge alpha, low-opacity edge mist; no global blur. Transition duration2400ms smoothstep, speech formation lead1968ms; TTS request starts immediately. Blink close120ms, hold65ms, open170ms, random idle spacing2.4–6.5seconds. No vendor/global animation changes.

## Live checks

Browser loaded `user-mask-956f066a5724.glb` in pult and paired clean scene. Formation and dissolve reached0/1 and reversed smoothly. Both automatic blink weights reached1; Blender full closed and separate-eye renders verified. One short real TTS request, cached repeat kept requests=1; mouth/audio/glow/head motion and paired pose transfer verified. Repeat disabled after test.

Node syntax checks and four existing suites (profiles, activity, clip cache, background) passed. FullHD limitation: clean scene retains16:9 sizing, but browser viewport override did not produce exact1920×1080 CSS dimensions on the current display; exact FullHD output is not claimed verified. No background appearance, voice configuration or secrets changed.

## Preview and delivery

Existing .local-preview config; LAN http://192.168.1.107:3100/ and localhost http://localhost:3100/. Keep server running. Secrets and local speech cache are ignored. Package: releases/user-mask-2026-10-24.zip. Working branch feat/doll-profile-packages only; no main/production deployment.

Reproduce Blender correction from adaptation committed at1e7d2f6, then run fix_blink_closure.py, read_edge_alpha.py, apply-user-mask-edge.py, check-user-mask-regression.py and package-user-mask.py. The correction script is for that baseline, not for reapplying to an already corrected adaptation.

## Added subtle attention motion — 2026-10-24

Direct follow-up request: small random head turns and almost imperceptible eye movement attending to the screen listener. Existing head pivot controller replaced, not stacked. Default bounds: yaw2.8°, pitch1.1° while speaking, half in idle; critically damped targets every2.6–6.5sec. After speech returns toward center for1.8sec. Eyes compensate65% of head turn with very small random adjustments every2.6–5.5sec, max2.2°. No webcam or actual person tracking.

Eight existing eyeLook targets now rotate ONLY the72 vertices of each separate globe about its own center. No skin, lid, brow or bridge movement. Full target12°; runtime bounded to2.2°. Fixed eye channels prevent concurrent engine random gaze from adding a second movement. Accepted neutral coordinates/normals/triangles/UV/texture and accepted blink targets remain byte-identical (glb-attention-regression-report.json). Blink correction accepted at commitf1bb8f9; gaze additions affect only eyeLook targets.

Parameters are bounded declarative appearance.attention fields, validated through profiles.mjs/attention.mjs. Unit test verifies amplitude, smoothness, sparse random sampling and compensating direction. Five suites pass. Browser shows changing headYaw/eyeYaw/actual eyeMorph, full blink peak1, no console errors. Speech/cache/paired scene verified with existing audio and no new generation after original one-request test. Latest package: releases/user-mask-2026-10-24-attention.zip.

## Current UI: independent motion controls — 2026-10-24

User reported no observable motion after9f83a78 and requested independent intensities. Previous idle head motion was limited to1.4° and independent eye jitter0.23°, nearly invisible on translucent face at display scale. No stale asset or inactive controller found: correct49c38f1fa339 asset and changing actual morph weights were verified.

New «Движение головы» and «Движение глаз» sliders0–300%, default100%, work immediately without speech. Idle head movement is no longer halved. Targets avoid arbitrarily tiny yaw excursions. At300% head limit8.4°, eye limit6°; neither deforms accepted mesh/UV/blink. Zero independently damps its channel to neutral. Profile-local eye-blink limiter no longer adds partial blinking from eye-down gaze; intentional blink/mood closing remains.

visuals.headMotion and visuals.eyeMotion are bounded0..3, included in snapshots and profile defaults. Every adjustment persists automatically through existing profile-settings API (only motion values merged into persisted settings), with local profile-specific fallback. Saved status is visible. Original lighting/voice/background settings preserved. Clean view now follows actual four-axis motion broadcast every60ms rather than independent random targets; interpolation adds a small delay.

Browser tests without TTS: head300/eyes0 produced5.5° head yaw and eye morph effectively0; head0/eyes300 produced3.6° gaze and neutral head. Both0 returned to neutral. Reload restored0/300. Both150 produced2.7° yaw and actual rendered eye morph0.0753, with clean view following. Both blink weights reached1 while movement active. Screenshots and measured values in motion-controls-report.json and previews/motion-*.jpg. Five relevant suites pass including new independent-zero/high-idle tests. Existing49c38f1fa339 GLB and Blender/source files untouched by this follow-up. Final live sliders restored100/100; all this follow-up's tests used0 TTS requests.

Latest package: releases/user-mask-2026-10-24-motion-controls.zip. FormatVersion remains1, adds optional bounded visuals fields; use with this updated app version. Exact FullHD limitation above still applies.

## Current update: continuous yaw/pitch and expression strength — 2026-10-24

This supersedes the held random targets / per-frame motion follower described above. Previous head controller held a target2.6–6.5seconds, then reset toward center after speech. Background pult RAF throttling also slowed its capped simulation clock and supplied sparse poses to clean view. Both causes removed.

Current trajectory is C2 cubic B-spline noise with independent slow/faster bands for yaw and pitch; there are no held target angles or speech-boundary resets. Both views use a shared channel seed and wall clock, each drawing its own smooth path. Three-stage gain smoothing makes intensity changes gradual, including zero. Sparse/background frame rates do not slow the clean scene. Existing head0–300% scales both axes; eye control remains independent and compensates toward virtual listener.

Actual clean-view record:256 samples over29.146sec at the user's195% head /170% eyes. Yaw−2.495°..+2.315°, pitch−0.803°..+1.204°. Longest near-zero velocity interval at threshold0.003°/sec: yaw0.107sec, pitch0.134sec (natural turns, no plateau). CSV and continuous-motion-report.json saved. Unit test also verifies continuous acceleration, no held samples and identical motion with/without speech, plus matching foreground/background clocks. Separate speech and post-speech CSVs retained.

New «Сила эмоции»0–200%, default100%, saved per profile with existing state/API. All five mood buttons retained. Neutral and zero strength fade to no expression. Happy smile raised from native0.16 per side to0.72 at100%; sad uses frown0.90 and inner brow0.80; fear uses wide0.85 with no contradictory squint. Upper intensity clamps existing expression weights to1. These are weight changes only: no new mesh, morph delta, UV or texture changes. Nose/jaw/viseme/blink/eye-look channels are excluded. Old profile-local random face/nose expressions suppressed to avoid conflicts with neutral and the selected mood. Mouth expression contribution scales to40% during speech; eye aperture/cheek emotion is gated off during full blink. Mood selection no longer restarts the native blink animation queue.

Browser: happy/sad/fear at0/100/200%, angry at0/100, neutral at0/200; medium/high screenshots saved. Every selected mood at0 produced exactly zero expression weights. Neutral at200 produced effectively zero. Speech test with smile yielded0.288 mouth smile while audio active; clean scene received pose frames and same mood/strength. One short TTS call, all repeats cached; stopped after check.101 speaking samples and155 idle samples in saved speech trace. Blink peak1 observed; full-blink aperture gating also checked by unit test. A screenshot timed exactly at fear blink peak was not captured reliably; do not claim that image as evidence.

Final settings preserve user's head195% and eyes170%; mood neutral, emotion100%, repeat off, text restored. The preview session expired during work and was signed back in using existing local credentials; no secret changed or printed. Source .blend, accepted GLB49c38f1fa339, UV and texture unchanged by these two follow-ups. Six relevant suites pass. Future bounded live mood setter and saved API documented in DIALOGUE_MOOD_API.md; no LLM or automation added.

Latest package: releases/user-mask-2026-10-24-continuous-emotions.zip, for the updated app version. FormatVersion remains1 with optional bounded emotionStrength. Server3100 remains available; working branch only. Exact FullHD output remains unverified as noted above.

## Current final update: tongue / oral cavity — 2026-10-24

Latest user criterion: tongue should be about10 times more transparent than the face and practically invisible. Current model user-mask-0ed7cc61f802.glb. Separate editable adaptation: blender/user-mask/mask_user_mouth_fix.blend. Accepted Blender adaptation, user source and previous profile are retained unchanged; rollback profile/model in assets/user-mask/approved-before-mouth/.

Diagnosis proven by colored helper renders: real tongue helper226vertices already moved with jawOpen/visemes but wore a stretched face-photo projection containing lower-lip/chin detail and filled the aperture. Removing that projection exposed coarse upper/lower tooth fitting proxies, and the rear mask surface also wore the photo. These made the repeated stationary-lip appearance.

Local correction only: tongue narrower/lower/deeper, existing morph deltas preserved (max numeric error2.63e-9m);96 fitting-proxy tooth faces removed from export;257-vertex concave cavity follows weighted deltas of nearby accepted lip-rim vertices. No detailed teeth or invented phonetic tongue track. The final user transparency clarification supersedes opaque tongue trials: extra rounding was discarded, geometry from verified214db working candidate retained; tongue material alpha.062 in Blender, runtime alpha=face opacity*.1, low emission and no photo map. Current face.62 → tongue.062. Transparent tongue depthWrite=false and renders after cavity; cavity is non-emissive near-black oral depth, preventing another grey plate or projected rear photo/background shining through. Outside material/shader appearance unchanged.

Export split into three materials. Protected face normals restored after Blender join. check-mouth-regression.py verifies4045 protected serialized vertices/UV,7332 protected triangles, exact normals, all68 protected morph deltas and embedded reference image bytes unchanged. New total8260triangles.

Visible-browser checks: neutral/A/O/I/M, real speech and cached repeat, no shader errors. Tongue alpha.062 and depthWrite=false confirmed in DOM. Actual tip sample positions differ between A/O/I/M (mouth-browser-report.json); do not claim independent phonetic tongue articulation. One short TTS request for this stage (older clip cache had expired); subsequent repeats kept requests=1. Repeat stopped, text restored. User settings at completion: head300%, eyes195%, emotion105%, mood neutral; these were preserved, not reset. Final preview formed and left available.

Blender close-ups: mouth-final-neutral/A/O/I/M, jaw-half/jaw-full and A-quarter. Before: mouth-before-A.png and mouth-diagnostic-A.png. Final browser views: mouth-final-browser-A/O/I/M/speech.jpg. Opaque intermediate trials parked under ignored .local-preview and are not the final deliverable.

Reproduction from accepted mask_user_adaptation.blend: fix_mouth_interior.py → finish_mouth_cavity.py → set_tongue_transparency.py on the working copy → export_mouth_work.py → restore-mouth-face-normals.py → apply-user-mask-edge.py with working GLB and edge-alpha-mouth.json → check-mouth-regression.py. Do not reapply geometry steps to an already corrected file. Existing older whole-buffer regression script targets the pre-mouth single-primitive export; use check-mouth-regression.py for this split export.

Latest package: releases/user-mask-2026-10-24-mouth.zip. Six existing relevant suites and Node syntax checks passed. No production change; working branch only. Preview3100 uses existing configuration/password/voice unchanged. Exact FullHD limitation remains as noted earlier.
