# CREDITS

## Hollow Watch — Asset & Engine Attribution

### Engine & Shading
- **Three.js** (`three/webgpu`, `three/tsl`): MIT License (Ricardo Cabello / Mr.doob and contributors).
- **TSL Display Passes** (`BloomNode`, `ChromaticAberrationNode`, `FilmNode`): MIT License (Three.js authors).

### Audio & Sound Effects
- All sound effects and ambient atmospheric layers are procedurally synthesized in real-time via the **Web Audio API** in [AudioManager.ts](src/audio/AudioManager.ts):
  - Procedural brownian noise wind filter generator
  - Dual-oscillator frequency-modulated crickets and night insects
  - Modulated pitch-drop synthesizer for distant horned owl cues
  - Sawtooth bandpass resonance synthesizer for creaking pine wood
  - Dual sub-frequency resonant filter for heartbeat pulses
  - High-transient noise burst generator for surface-specific footstep clicks (dirt/leaves)
  - Triangle click generator for tactile flashlight toggle
  - Multi-stage square-wave mechanical generator for flashlight battery swaps
  - Composite multi-channel crack, sub-thump, and 2.2s exponential lowpass convolution reverb for gunshot acoustics
  - Sawtooth acoustic chime for magazine reload and pickups
- Zero external audio files required — the game runs 100% procedurally with zero missing asset warnings.

### Geometry & Textures
- **1K PBR Textures** (CC0 / Public Domain via [ambientCG](https://ambientcg.com)):
  - **Ground / Forest Floor**: `Ground037` by Lennart Demes (CC0) — Diffuse, Normal (GL), Roughness.
  - **Pine Bark**: `Bark014` by Lennart Demes (CC0) — Diffuse, Normal (GL), Roughness.
  - **Rocks & Cliffs**: `Rock035` by Lennart Demes (CC0) — Diffuse, Normal (GL), Roughness.
  - **Wood Planks (Cabin, Floor, Fence)**: `Wood051` by Lennart Demes (CC0) — Diffuse, Normal (GL), Roughness.
  - **Weathered Painted Metal (Ranger Truck & Gate)**: `Metal029` by Lennart Demes (CC0) — Diffuse, Normal (GL), Roughness.
- **Procedural Terrain**: Multioctave FBM noise generator with packed-dirt trail splatting, tire ruts, and normal mapping.
- **Procedural Instanced Pine Forest**: Stacked cone foliage with organic vertex jitter displacement.
- **Clutter**: Procedurally generated canvas alpha-cutout fern cards, low-poly dodecahedron rocks, and fallen tree trunks.
- **Viewmodel Rig**: Tactical rifle model + procedural left forearm sleeve, tactical glove, and canvas CRT tracker display.

### 3D Models (`public/models/`)
- **Rifle (`rifle.glb`)**: `bolt_action_rifle_7_62` from [Poly Haven](https://polyhaven.com/a/bolt_action_rifle_7_62) — **CC0** (Public Domain), optimized via `gltf-transform` (meshopt, 1K WebP textures, 6,994 triangles).
- **Ranger Truck (`truck.glb`)**: `vehicle-truck-green` from [Kenney Car Kit / Starter-Kit-Racing](https://kenney.nl/assets/car-kit) — **CC0** (Public Domain), optimized via `gltf-transform` (meshopt, 1,104 triangles).
- **Lantern (`lantern.glb`)**: `wooden_lantern_01` from [Poly Haven](https://polyhaven.com/a/wooden_lantern_01) — **CC0** (Public Domain), optimized via `gltf-transform` (meshopt, 1K WebP textures, 2,116 triangles).
- **Diesel Generator (`generator.glb`)**: `portable_generator` from [Poly Haven](https://polyhaven.com/a/portable_generator) — **CC0** (Public Domain), optimized via `gltf-transform` (meshopt, 1K WebP textures, 4,476 triangles).
- **Ranger Desk (`desk.glb`)**: `metal_office_desk` from [Poly Haven](https://polyhaven.com/a/metal_office_desk) — **CC0** (Public Domain), optimized via `gltf-transform` (meshopt, 1K WebP textures, 2,069 triangles).
- **Bunk / Day Bed (`bed.glb`)**: `vintage_day_bed` from [Poly Haven](https://polyhaven.com/a/vintage_day_bed) — **CC0** (Public Domain), optimized via `gltf-transform` (meshopt, 1K WebP textures, 2,306 triangles).
- **Pine Trees (`pine_1.glb`) & Dead Trees (`dead_tree.glb`)**: `PineTree_1` (1,911 triangles) & `CommonTree_Dead_1` (2,360 triangles) from [Quaternius Nature Pack](https://quaternius.com/) — **CC0** (Public Domain), optimized via `gltf-transform` (meshopt).
