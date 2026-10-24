# Accepted user mask — 2026-10-24

User accepted the local blink/UV correction on 2026-10-24. Profile: `user-mask`, model `user-mask-956f066a5724.glb`. Do not rebuild from reference002 or older procedural faces.

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
