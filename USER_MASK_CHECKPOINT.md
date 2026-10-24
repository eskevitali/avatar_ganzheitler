# User mask checkpoint — 2026-10-24

Authoritative appearance: user-authored Blender correction accepted on 2026-10-23, profile `user-mask`. Do not rebuild from older reference002 or procedural faces.

Untouched accepted source and texture: `assets/user-mask/source/`, hashes in checkpoint.json. User original blender/002/mask_002_working.blend and backups003/004 remain user-owned and unmodified by this checkpoint.

Adaptation: blender/user-mask/mask_user_adaptation.blend. Neutral retained head geometry matches accepted source exactly (preservation_report.json); exact projection baked to UV. 68 speech/expression targets transferred from CC0 MakeHuman targets. Separate export copy only.

Approved browser asset preserved in assets/user-mask/approved-before-edge. Current candidate user-mask-49ca2e8a2ac4.glb adds boundary vertex alpha only. public/user-mask.mjs adds sparse boundary strands, subtle edge mist and 2400ms smooth reveal; these pending changes still require browser visual verification.

Known unresolved: full eye closure. Existing full-blink render leaves visible iris and eyelash overlap. Must inspect and fix morphs in adaptation, preserving neutral geometry/UV/texture. New-mask real TTS and paired clean FullHD validation remain pending.

Preview uses existing .local-preview configuration. Never commit local configuration, voice settings or credentials. No main/production deployment authorized.
