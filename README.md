# HOLLOW WATCH: A Browser Horror FPS (WebGPU)

> **Instructions for the AI coding agent (Cursor / Antigravity / Claude Code):**
> Read this entire file before writing code. Build the game **milestone by milestone** (Section 12). After each milestone, run the project, confirm the acceptance criteria, and fix issues before moving on. Do not add features that are not in this file. Keep it small, atmospheric and finishable.

---

## 1. Concept

A short, single-level, first-person horror game that runs in the browser.

- **Genre:** Atmospheric survival horror, FPS.
- **Playtime:** 30 to 45 minutes (up to ~60 for slow players).
- **Setting:** A dense pine forest at night. Heavy fog, a low moon, wet ground, near-total darkness. The **flashlight** is your main way of seeing.
- **Tone:** Slow dread, not jump-scare spam. Silence, distant sounds, a presence that is always watching. Scares are earned.
- **Reference look:** Dark teal/green night palette, cold moonlight through mist, a tall dark silhouette of a human-shaped figure far away in the fog, tiny warm lights (lanterns) in the distance, a weapon held in the lower-right of the screen with a glowing green wrist/gadget readout. Think *Alan Wake*, *Silent Hill* (2024), *The Forest*, *Unrecord*-style grit.

---

## 2. Story

**Title:** Hollow Watch

**Player character:** Elias Kerr, a forest warden.

**Setup:** The logging village of Harrow's End has lost 6 people in two months. All vanished near the Hollow Pine Forest. The locals call the thing that takes them **"the Watcher"**, a tall shadow that stands at the edge of your vision and is never there when you look straight at it. Elias's partner, **Mara Voss**, went in three nights ago and stopped answering the radio. Tonight Elias goes in after her, carrying a rifle, a flashlight and a handheld radio/tracker.

**The truth (revealed through notes and radio):**
1. Years ago the wardens sealed a sinkhole ("the Hollow") in the forest after a mining accident killed 11 workers. They covered it with an iron grate and a ring of **Lantern Posts** to "keep the dark in".
2. The shadow is the *collective hunger of the dead trapped below*. It is repelled by concentrated light but grows when people are afraid.
3. Mara went in to relight the Lantern Posts, which have been dying out one by one. She succeeded in relighting some, then was taken.
4. Twist: The **radio voice** guiding Elias in Act 2-3 is not Mara. It is the Watcher imitating her, steering him toward the Hollow so he will open the grate.

**Ending (two variants, decided by one final choice):**
- **Ending A, "Seal It":** Elias relights the final Lantern Post, the Watcher is forced back into the Hollow, and he welds the grate shut. Dawn breaks. Mara's jacket is on the grate. She is gone. Bittersweet.
- **Ending B, "Open It":** Elias hears Mara's real voice from below and opens the grate. The screen cuts to black, then to a daylight shot of the forest road with a lone figure walking out. Last frame: the figure's shadow is too tall. Dark twist.

Keep both endings short (30 to 60 seconds of text/cutscene each).

---

## 3. Level Layout & Story Beats (the 30 to 45 minute path)

One continuous forest map (~400 m x 400 m playable area, bounded by dense trees, a cliff wall and a river). Linear-ish with side exploration.

| Act | Place | Goal | Time |
|---|---|---|---|
| **0. Prologue** | Ranger truck at the forest edge | Tutorial: look, move, flashlight, radio. Read the briefing note. Walk through the gate. | 2-3 min |
| **1. The Trail** | Forest path to Ranger Station 7 | Follow the trail, find Mara's dropped backpack and first note. First distant sighting of the Watcher (silhouette between trees, as in the reference image). | 6-8 min |
| **2. Ranger Station 7** | Abandoned cabin with a locked door | Find the **Generator Fuse** in the forest, restore power, read the logs, get the **Iron Key**. Safe-room feeling: one light, one save point. | 8-10 min |
| **3. The Lantern Posts** | 4 Lantern Posts spread across the forest | Relight 3 lantern posts (fuel cans found nearby). Each relight triggers a Watcher hunt (see Section 6). Radio voice "Mara" guides you. | 12-15 min |
| **4. The Hollow** | Sinkhole with the iron grate | Final Lantern Post is here. Survive the climax encounter. Listen to the radio. Make the final choice (Seal / Open). | 5-8 min |
| **5. Epilogue** | Ending cutscene | Show the chosen ending, then credits. | 1-2 min |

Each act has a clear **objective line** shown on screen (small bottom-left text, e.g. "Find the generator fuse").

### Collectibles / Props
- **Notes (8 total):** Short text pickups that tell the story (see Section 11 for the list of note ideas). Displayed as a full-screen paper overlay, press `E` or `Esc` to close.
- **Generator Fuse** (1), **Iron Key** (1), **Fuel Cans** (3), **Rifle ammo boxes** (around 6 spread around), **Batteries** (around 8).
- **Lantern Posts** (4): interactive, hold `E` for 3 seconds to relight (with a flickering sound and light growing).

---

## 4. Core Mechanics

### 4.1 Player (FPS controller)
- Pointer Lock mouse look, `WASD` move, `Shift` sprint (drains stamina), `Ctrl`/`C` crouch (slower, quieter), `Space` is not used (no jumping; keep it grounded and tense).
- Head bob (subtle), footstep sounds that depend on surface (dirt, leaves, wood, metal).
- Height follows the terrain; collision against trees, rocks, cabin walls and the map boundary.
- Walk speed ~3.0 m/s, sprint ~5.5 m/s, crouch ~1.5 m/s. Stamina ~6 s of sprint, recharges when not sprinting.

### 4.2 Flashlight (core mechanic)
- `F` toggles the flashlight. Implemented as a `SpotLight` (cone ~28 deg, soft penumbra, range ~35 m) parented to the camera with **slight lag/sway** (smoothly follows the camera rotation) so it feels hand-held.
- **Battery:** drains while on (~4 minutes per battery, 100% to 0%). Below 25% it **flickers** more often. At 0% it dies. Press `R` to swap in a battery (takes ~1.5 s with an animation/sound). 
- A faint warm-white color (~`#dfe8ff` cold, slightly blue-green to match the mood), with a subtle cookie/vignette to look like a real torch beam.
- **Fake volumetric beam:** add a cheap additive cone mesh (low alpha) or screen-space light shafts so the beam is visible in fog.
- Flashlight is **the only thing that damages the Watcher** (see Section 6).

### 4.3 Weapon
- A rifle (see reference image: an SMG/assault-rifle style weapon at lower-right). Use a CC0/low-poly glTF model if available; otherwise build a simple blocky model from primitives (box barrel, box stock, a cylinder).
- `Left Mouse` fire, `Right Mouse` aim down sights (slightly narrower FOV, tighter sway), `R` reload when the flashlight is not being changed. Mag 20 rounds, reserve starts at 40.
- Recoil kick on the camera + gun model, muzzle flash (a short point light + sprite), loud gunshot with long reverb tail (this also **alerts the Watcher**, see Section 6).
- Weapon is **weak against the Watcher** (it staggers him briefly when he is lit); the main use is vs. **Hollow Crows** and to create tension (ammo scarcity).

### 4.4 Handheld Radio / Tracker (the green glow in the image)
- A left-wrist device with a small **green glowing display**. It shows: battery %, ammo count, and a **noise/threat bar** (rises when the Watcher is near). Rendered as a small emissive mesh on the left hand/arm in view.
- Plays story audio (Mara's voice lines) with static. Static intensity increases as the Watcher gets closer. **This is the main proximity-warning tool** (no HUD minimap).

### 4.5 Health & Fear
- Health: 100 HP. No regenerating health during an encounter; slow regen to 60% only in lit safe areas (the cabin, lit Lantern Posts).
- **Fear meter (hidden):** rises when in the dark, when the Watcher is in line of sight, and when the flashlight is off; lowers near lantern light. High fear causes: heartbeat audio, slight screen vignette pulse, subtle FOV breathing, hallucinated sounds (whispers, snapping branches). Purely atmospheric; it does **not** change difficulty directly.

### 4.6 Saving
- Auto-save at checkpoints (after each act, after each lantern relit) using `localStorage`. Simple JSON: act, inventory, position, notes found, ammo, batteries, lanterns lit. A "Continue" button on the main menu.

---

## 5. Controls (show on a simple menu screen)

| Key | Action |
|---|---|
| `W A S D` | Move |
| `Mouse` | Look |
| `Shift` | Sprint |
| `Ctrl` / `C` | Crouch |
| `F` | Flashlight on/off |
| `R` | Reload weapon (tap) / swap flashlight battery (hold) |
| `LMB` / `RMB` | Fire / Aim |
| `E` | Interact (pick up, read, relight; hold for long actions) |
| `Tab` | View collected notes |
| `Esc` | Pause menu |

---

## 6. Enemies & AI

### 6.1 The Watcher (main enemy, only one)
- A tall (~2.8 m), thin, humanoid shadow silhouette with long limbs. Render as a **dark skinned mesh with a dissolve/noise-edge shader** (TSL node material or simple custom shader): mostly black, flickers, edges smoke away, faint cold-teal rim. If a rigged model isn't available, use a stretched humanoid primitive set + vertex-displacement shader for a jittery, wrong look.
- **It is invisible/almost invisible when not hit by the flashlight and not very close.** It only fully materializes in the flashlight beam or within ~4 m.
- **State machine:**
  1. `STALK`: Keeps ~25 to 40 m away, moves between tree trunks, visible only as a silhouette far away. Never attacks. Teases the player. (Used in Acts 1 and 2.)
  2. `INVESTIGATE`: Heads toward the last place a loud noise was heard (gunshot, sprinting, a dropped item).
  3. `HUNT`: Triggered during Lantern relights and the finale. Moves quickly toward the player (~4.5 m/s). Disappears when hit by the flashlight beam for 1.2+ seconds, retreating then circling back from another direction.
  4. `RETREAT`: After taking enough "light damage" (see below) or when the player stands inside a lit Lantern Post radius (~8 m safe zone), it backs off with a screech.
- **Light damage:** Accumulates while the flashlight cone hits it (ray test + cone-angle test). When the bar fills, it retreats for 20 to 40 seconds. No health bar shown.
- **Kill rule:** It cannot be killed until the finale (see Section 7). Shots only stagger it.
- **Touch attack:** If it reaches the player, it deals heavy damage (50 HP) and teleports a short distance away, so the player gets another chance (no instant fail except at 0 HP).
- **"Look away" mechanic (optional, if time permits):** In STALK, if the player looks directly at it for >2 s, it vanishes and reappears at a different spot behind them.

### 6.2 Hollow Crows (minor, optional)
- 4 to 6 crow-like creatures perched on trees; they screech and flap when you come close, revealing your position to the Watcher. Can be shot (1 hit). Used to make players nervous and reward careful movement. Skip if time is short.

### 6.3 Audio-driven scares (non-enemy)
- Distant knocks on wood, a child's laugh, the radio picking up whispers, footsteps behind you that stop when you stop, a swaying lantern with no wind, a door slowly opening. Triggered by script volumes along the path (see Section 8).

---

## 7. Finale (Act 4 sequence)

1. The player reaches the Hollow. A circular clearing, the iron grate in the center, the 4th Lantern Post (dead).
2. Radio: "Mara" begs the player to open the grate. Fake emotion, glitchy phrasing.
3. Player must relight the final Lantern Post (hold `E`, 6 s), while the Watcher is in full `HUNT` and keeps lunging. The player must keep the flashlight on it to push it back while the lantern fuel flows (a 6 to 8 second tense interaction with "light damage" bar showing).
4. When the lantern lights: the Watcher is flung back and weakened (long scream, ground rumble).
5. **Choice (prompt on screen):**
   - Approach the grate (hold `E`) and **Weld it shut** (needs the welding tool found in Station 7) to get Ending A.
   - Or press `E` on the grate's lock using the **Iron Key** to get Ending B. (The key is only needed for Ending B; Ending A needs the welder.)
6. Cut to ending text/cutscene.

---

## 8. World & Level Design Rules

- **Terrain:** A heightmap-based terrain (generated procedurally with simplex noise, rolling hills of ±6 m). A winding dirt trail (a lighter, packed-dirt texture splat) connecting all key locations.
- **Trees:** Dense pine/fir forest. Use **instanced meshes** (`InstancedMesh`) with ~2,500 to 4,000 trees total near the player, with 3 LOD levels (high-poly near, billboards or crossed planes far). Add dead trees and logs along the trail.
- **Ground cover:** Instanced ferns/grass cards, rocks, fallen leaves decals. Wet look (high roughness variation, slight specular from the moon).
- **Structures:** Ranger truck (static), forest gate with chain fence (as seen on the right side of the reference), Ranger Station 7 (small cabin, interior with desk, bunk, generator room), watchtower (optional vista), 4 Lantern Posts, the Hollow clearing with iron grate.
- **Landmarks:** Distant warm lantern glows between trees (like the amber light in the reference) to guide the player along the path.
- **Collision:** Don't use a heavy physics engine. Use a **simple custom collision system**: terrain height sampling for ground, trees/rocks as 2D circles in XZ in a spatial hash, cabin walls as AABBs. Capsule-vs-circle/AABB resolution is enough.
- **Triggers:** Invisible trigger boxes in the level data (JSON) to start audio scares, radio lines, objective updates and Watcher state changes.

---

## 9. Visual Style (match the reference image)

**Target look:** Cinematic, moody, desaturated teal-green night with strong fog depth and a low-hanging pale moon (visible in the sky, like in the picture).

### Lighting
- **Moon:** a dim cool `DirectionalLight` (~`#8fb3c9`, intensity low), low angle, casting long soft shadows (use one shadow cascade or a single large shadow map centered on the player).
- **Ambient:** very low hemisphere light (dark blue-green sky, near-black ground).
- **Flashlight:** the main shadow-casting `SpotLight` (1024 or 2048 shadow map). The only other shadow caster is the moon. All other lights (lanterns, muzzle flash, windows) are **non-shadow** point lights; limit to ~6 active at a time near the player.
- **Emissives:** lantern flame, the radio screen (green), the amber lights far away.

### Atmosphere
- **Exponential-squared fog**, color dark teal (`~#0b1a1c` to `#14272a`), density tuned so objects fade out at ~60 to 80 m.
- **Sky:** dark gradient with a bright moon disc + halo, thin cloud wisps (a simple shader or a skybox texture). Stars faintly visible.
- **Ground mist:** a few large soft sprite layers or a height-fog effect near the terrain, drifting slowly. Light shafts in the flashlight beam.
- **Particles:** floating dust/pollen in the beam, falling leaves, occasional fog wisps, breath vapor on sprint (subtle).

### Post-processing (use the WebGPU post-processing pipeline)
- Subtle **bloom** (on lights and the moon), **vignette**, **film grain**, slight **chromatic aberration** on the screen edges, mild **color grading** (crushed blacks, teal shadows, slightly warm highlights from lanterns), optional **depth of field** at low strength, optional **motion blur** (very subtle).
- **Fear effects:** vignette pulse, tiny screen distortion, desaturation increase when the Watcher is close.
- Optional: a slightly lowered internal resolution (e.g. 0.85x) with FXAA/TAA for performance and a more "gritty" look.

### Models & Textures
- Prefer **CC0 / free-license** assets: Poly Haven (textures, HDRI, some models), Quaternius, Kenney, ambientCG, Sketchfab (CC0/CC-BY only; keep a `CREDITS.md`).
- If assets are missing, **generate procedural fallbacks** (primitive trees, procedural noise textures). The game must still run with zero external assets.
- Keep the total download **under ~60 MB** (compressed textures like KTX2/Basis, Draco/meshopt for glTF).

---

## 10. Audio

Audio makes 60% of horror. Use the **Web Audio API** (or Howler.js) with 3D positional audio.

- **Ambience loops:** wind through pines, crickets/night insects (fade out near the Watcher: *silence = danger*), distant owl, creaking trees, river.
- **Music:** very sparse. Low drones that rise with fear/hunt state, a short cue for discoveries, a heartbeat layer. Silent most of the time.
- **SFX:** footsteps by surface, flashlight click, battery swap, rifle shot with long echo/reverb, reload, interact sounds, lantern ignition, radio static and voice lines, door creaks, Watcher whisper/screech/stalk sounds (layered, pitched down).
- **Dynamic mix:** a master low-pass filter that muffles sound slightly when afraid; a convolution reverb for the forest. 
- **Voice lines:** use text-to-speech *placeholder* files (or subtitles only) for Mara/Elias; every voice line **must have subtitles** (toggleable). Free sources: freesound.org (CC0), Pixabay, Sonniss GDC bundles (check licenses).
- Start audio only after the first user click (browser autoplay policy).

---

## 11. Notes Content (story pickups, short, ~2 to 4 sentences each)

Write these in a gritty, personal voice. Suggested topics:

1. **Briefing (Prologue):** Warden Kerr's orders: search for Mara Voss, last seen near Station 7.
2. **Mara's backpack journal:** She heard knocking on trees at night, followed it, found a dead lantern.
3. **Station 7 log #1:** The old wardens' rule: "Never let the posts go dark."
4. **Station 7 log #2:** Mining accident, 11 dead, the Hollow sealed with iron.
5. **Villager letter:** The vanishing started the year the lanterns began failing.
6. **Mara's second journal:** She is relighting posts; the radio keeps playing her own voice back to her.
7. **Torn page:** "It copies voices. It copies *hers*. Don't trust the radio after the third post."
8. **Final note at the Hollow:** Mara's last words, ambiguous enough to support both endings.

Display each as a paper overlay with a handwritten-style font, plus a stained paper texture.

---

## 12. Tech Stack & Architecture

### 12.1 Stack (keep it simple)
- **Language:** TypeScript.
- **Bundler:** Vite.
- **Renderer:** **Three.js `WebGPURenderer`** (import from `three/webgpu`, with node materials via **TSL** from `three/tsl`). It automatically falls back to WebGL 2 if WebGPU is unavailable. *Before coding, check the current Three.js docs/examples for the exact current import paths, post-processing class names (they have been renamed across versions) and the latest stable version. Pin the version in `package.json`.*
- **Audio:** Web Audio API (or Howler.js).
- **UI/HUD:** Plain HTML/CSS overlay on top of the canvas (no framework needed).
- **Physics:** None. Use the custom collision from Section 8 (no Rapier/Cannon, to keep it light).
- **State:** Simple event bus + a single `GameState` object. No heavy ECS.
- **Deploy target:** Static site (Vercel / Netlify / GitHub Pages / Cloudflare Pages). No backend.

### 12.2 Browser support & fallback
- WebGPU works in current Chrome/Edge, and in recent Firefox and Safari versions on supported platforms. Always run a feature check (`navigator.gpu`). If it is missing, let the Three.js renderer fall back to WebGL 2 and show a small non-blocking notice. Test in Chrome first.
- Add a **graphics quality toggle** (Low / Medium / High): changes shadow map size, tree count, post-processing, resolution scale.

### 12.3 Suggested folder structure
```
hollow-watch/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ README.md            <- this file
├─ CREDITS.md           <- asset licenses
├─ public/
│  ├─ audio/
│  ├─ models/
│  └─ textures/
└─ src/
   ├─ main.ts            <- bootstrap, menu, game loop
   ├─ core/
   │  ├─ Game.ts         <- state machine: MENU, PLAYING, PAUSED, ENDING
   │  ├─ Input.ts        <- keyboard, mouse, pointer lock
   │  ├─ Time.ts         <- fixed-step + render loop
   │  ├─ EventBus.ts
   │  └─ SaveSystem.ts
   ├─ render/
   │  ├─ Renderer.ts     <- WebGPURenderer setup, resize, quality settings
   │  ├─ PostFX.ts       <- bloom, vignette, grain, grading (TSL)
   │  ├─ Sky.ts          <- sky, moon, stars
   │  ├─ Fog.ts
   │  └─ Particles.ts
   ├─ world/
   │  ├─ Terrain.ts      <- heightmap + trail splat
   │  ├─ Forest.ts       <- instanced trees, rocks, grass
   │  ├─ Structures.ts   <- cabin, gate, truck, lantern posts, hollow
   │  ├─ LevelData.ts    <- positions, triggers, objectives (JSON-like)
   │  └─ Collision.ts
   ├─ player/
   │  ├─ PlayerController.ts
   │  ├─ Flashlight.ts
   │  ├─ Weapon.ts
   │  ├─ Radio.ts        <- wrist device + audio lines
   │  └─ Inventory.ts
   ├─ enemies/
   │  ├─ Watcher.ts      <- mesh, shader, state machine
   │  └─ Crow.ts         <- optional
   ├─ story/
   │  ├─ Objectives.ts
   │  ├─ Notes.ts
   │  ├─ Triggers.ts
   │  └─ Endings.ts
   ├─ audio/
   │  └─ AudioManager.ts
   └─ ui/
      ├─ HUD.ts
      ├─ Menu.ts
      ├─ NoteViewer.ts
      └─ styles.css
```

### 12.4 Performance budget (target: 60 FPS on a mid-range laptop with integrated or entry-level GPU; 30 FPS floor)
- Draw calls < 300; triangles < ~1.5M visible.
- Only **2 shadow-casting lights** (moon + flashlight). Shadow map sizes: moon 2048, flashlight 1024.
- Trees: instanced; far trees as simple cross-quads; cull beyond ~90 m (fog hides the pop-in).
- Do not recreate geometry or materials every frame; reuse vectors/objects; pool particles.
- Load assets with a loading screen and progress bar.
- Provide an FPS counter toggle (`F3`) for debugging.

---

## 13. Milestones (build in this order)

Each milestone must be playable/runnable before moving to the next. Commit after each.

**M1: Project & Renderer**
- Vite + TS + Three.js WebGPURenderer. Black screen with a rotating test cube, fog, resize handling, FPS counter.
- *Accept:* Runs with `npm run dev`; no console errors; logs which backend (WebGPU/WebGL2) is active.

**M2: FPS Controller & Terrain**
- Pointer lock, WASD, sprint, crouch, head bob. Procedural terrain with height following. Boundary walls.
- *Accept:* Can walk around a hilly empty terrain smoothly, no falling through.

**M3: Forest & Atmosphere (the "look")**
- Instanced pine forest, ground cover, moon + sky, teal exponential fog, ground mist, low ambient light. Match the reference screenshot mood.
- *Accept:* A screenshot from the trail looks close to the reference image: dark teal fog, silhouettes of trees, moon visible, depth fade.

**M4: Flashlight**
- Spotlight with sway/lag, shadows, battery drain, flicker, battery swap, beam shafts/dust particles.
- *Accept:* Flashlight lights up trees with shadows; battery logic works; flicker at low battery.

**M5: Weapon & Radio HUD**
- Rifle model in the view (lower-right), recoil, muzzle flash, reload, ADS. Left-wrist green display showing ammo/battery/threat.
- *Accept:* Shooting and reloading feel responsive; the wrist display matches the green glow of the reference.

**M6: Post-processing & Audio**
- Bloom, vignette, grain, grading, chromatic aberration; ambience loops, footsteps, positional audio, dynamic fear effects.
- *Accept:* Toggling post FX visibly changes the look; audio starts after the first click; no clipping.

**M7: Level Content**
- Trail, gate, Ranger truck, Station 7 interior, 4 Lantern Posts, the Hollow clearing, pickups (notes, fuse, key, fuel, batteries, ammo, welder) with interaction prompts and a note viewer.
- *Accept:* Every item is placeable/pickable; the objective line updates correctly.

**M8: The Watcher**
- Mesh + dissolve shader, STALK / INVESTIGATE / HUNT / RETREAT states, light-damage logic, audio cues, touch attack.
- *Accept:* Watcher appears as a distant silhouette in Act 1, hunts during lantern relights, retreats when lit and in lantern safe zones.

**M9: Story Flow, Triggers, Saves**
- Act progression, radio lines + subtitles, scripted scares, checkpoints with save/load, main/pause menus.
- *Accept:* A full playthrough from the truck to the credits is possible without bugs; "Continue" works after a refresh.

**M10: Finale & Endings**
- Hollow sequence, final choice, both endings (text + fade + simple camera shot), credits, restart.
- *Accept:* Both endings can be reached; restart works.

**M11: Polish & Optimization**
- Quality presets, loading screen, performance pass, bug fixes, difficulty tuning (see Section 14), `CREDITS.md`, a production build (`npm run build`) and deploy instructions.
- *Accept:* Stable 60 FPS on Medium preset on a mid-range machine; build is under ~60 MB.

---

## 14. Difficulty & Pacing Tuning

- Resource scarcity: ~6 batteries total in Acts 1 to 3 (+2 near the finale), ~60 rounds total. Be generous enough that the player never feels stuck.
- Never let the Watcher kill the player in less than 3 hits; give lots of audio warning before each hunt.
- Add short safe breathing moments (the cabin, lit lanterns) between tense sequences. Horror needs contrast.
- Include a **"Hint" objective marker** that appears after 5 minutes of no progress (a subtle direction hint in the radio: "Head toward the amber light").
- Optional accessibility: subtitles on, reduced screen shake, reduced flashing, adjustable sensitivity, and a "flicker-free" flashlight option.

---

## 15. Out of Scope (do NOT build)

- Multiplayer, online features, accounts, leaderboards.
- Multiple levels, open-world quests, crafting, skill trees, complex inventory.
- Realistic physics engine, ragdolls, destructible objects.
- Large cinematic videos. Use in-engine camera shots and text.
- Anything that needs a backend server.

---

## 16. Definition of Done

- [ ] Opens in a modern browser, starts from a menu, and enters pointer lock on click.
- [ ] Looks like the reference: dark teal night forest, fog, moon, flashlight beam, rifle at lower-right, green wrist glow.
- [ ] First-person movement, flashlight with battery, rifle, radio device all work.
- [ ] The Watcher stalks, hunts, and retreats from light, with great audio.
- [ ] 8 notes, 3 lantern relights, a final Hollow sequence with a two-way choice, both endings reachable.
- [ ] Saves/checkpoints and restart work.
- [ ] Runs at ~60 FPS on a mid-range laptop (Medium preset), with a Low preset for weaker machines.
- [ ] `CREDITS.md` lists all third-party assets and their licenses.
- [ ] `npm run build` produces a static site ready to deploy.

---

## 17. Quick Start Prompt (paste this into Cursor / Antigravity)

> Read `README.md` fully. Set up a Vite + TypeScript project with Three.js `WebGPURenderer` (check the latest docs for the correct imports and pin versions). Implement **Milestone M1 and M2** first, run the dev server, verify the acceptance criteria, then continue milestone by milestone, committing after each one. Ask me before changing scope. Use procedural placeholder assets whenever a real asset is not available so the game always runs.
