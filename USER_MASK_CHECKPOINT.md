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
