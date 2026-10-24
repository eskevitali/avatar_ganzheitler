# User-mask mood control

The app changes existing expression weights; it does not generate dialogue or call an LLM.

## Live frontend entry point

In the existing page's JavaScript module context:

```js
import {setDialogueMood} from '/app.js';
await setDialogueMood({mood:'happy', intensity:1.2});
```

Allowed moods: `neutral`, `happy`, `sad`, `fear`, `angry`. Intensity is a finite number in `[0,2]`, corresponding to the UI's0–200%. Zero and neutral both remove the expression with a smooth transition. This function requires the active `user-mask` profile. It updates the UI, saves the profile and broadcasts bounded settings to the paired clean view. It does not change voice credentials or text.

The existing `BroadcastChannel` settings envelope uses `settings.mood` and `settings.visuals.emotionStrength`; both are validated by `settingsOf`. The existing head/eye controls use `settings.visuals.headMotion` and `eyeMotion`, each0..3.

## Saved settings API

Authenticated `GET /api/profiles` reads settings. Authenticated `POST /api/profile-settings` saves a complete settings object. Merge into the existing object to preserve lip tuning and lighting:

```js
const settings={...previous,mood:'sad',visuals:{...previous.visuals,emotionStrength:.8}};
// POST /api/profile-settings with JSON {id:'user-mask',settings}
```

This HTTP route persists settings; it does not push a live change into an already-open pult. Use `setDialogueMood` for live control and existing paired scene synchronization. No new public endpoint, automation or generation has been added.

## Rendering rules

- Expression presets contain no nose, jaw, viseme, eye-look or blink channels.
- Neutral facial idle randomness is suppressed for this profile; intentional blink and gaze remain.
- Expression mouth contribution is reduced to40% during speech; speech jaw/visemes retain ownership.
- Eye aperture and cheek expression weights fade as `(1-blink)^2`, preserving closed-lid geometry.
- Intensities and mood are saved automatically per profile; local storage is a fallback if the preview server is unavailable.
