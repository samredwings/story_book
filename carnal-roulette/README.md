# Carnal Roulette VR

Standalone interactive / WebXR adult module for IMG-VDO. Runs as a browser page (or iframe plugin) with an asset pipeline, Three.js scene, and ECS-style systems.

## Run

Open `index.html` via a local static server (required for modules / camera / XR):

```bash
npx serve carnal-roulette
# or: python3 -m http.server 8080 --directory carnal-roulette
```

Then visit the served URL. Desktop mode uses mouse + keyboard; VR uses WebXR when available.

## Layout

```
carnal-roulette/
├── index.html              # Entry + asset pipeline UI + VR overlay
├── module-manifest.json    # Parent-app plugin contract
├── Plugin Manifest.json    # Legacy manifest name (same role)
├── css/main.css
├── js/                     # Runtime scripts (load order in index.html)
├── docs/                   # Architecture notes
└── tests/                  # Browser console pentest harness
```

### Script groups (load order)

| Group | Files | Role |
|-------|--------|------|
| Engine | `engine_core.js`, `engine_event-bus.js` | ECS + events |
| Game / assets | `game-logic.js`, `asset-loader.js`, `story-asset-pipeline.js` | Rounds, uploads, context→scene |
| Audio | `audio.js`, `systems_audio-system.js` | SFX / procedural |
| Input | `interaction.js`, `systems_interaction-controller.js` | VR controllers + desktop FP |
| Penetration / IK | `systems_penetration-*.js`, `systems_ik-penetration.js` | Physics + targeting |
| Narrative | `systems_narrative-tone.js`, `systems_dialogue-engine.js`, `systems_action-catalog.js`, `narrative-state-machine.js` | Tone, dialogue, actions |
| Scene / UI | `fluid-system.js`, `recorder.js`, `ui-controller.js`, `vr-scene.js` | FX, capture, HUD, Three/XR |
| Plugin | `plugin-interface.js`, `plugin-api.js`, `taboo-roulette.js` | Parent postMessage bridge |
| Boot | `app.js` | Init sequence |

## Plugin integration

Parent apps can embed this module and talk over `postMessage` using hooks declared in `module-manifest.json` (`onAssetReady`, `onStateSync`, `onNarrativeEvent`).

## Cleanup (2026-09-03)

Removed unused / superseded scripts that were never loaded by `index.html`:

- `js/code.js` (duplicate of `systems_interaction-controller.js`)
- `js/ik-penetration.js` (stub; replaced by `systems_ik-penetration.js`)
- `js/animation.js`, `js/advanced-animation.js` (never registered)
- Moved pentest harness → `tests/automated-test-script.js`
- Docs → `docs/`
