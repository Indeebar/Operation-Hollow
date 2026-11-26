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
- **Viewmodel Rig**: Handcrafted procedural tactical rifle with iron sights, left forearm sleeve, tactical glove, and canvas CRT tracker display.
