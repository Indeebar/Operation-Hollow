// src/world/LevelData.ts

export interface Waypoint {
  x: number;
  z: number;
}

export interface LanternPostData {
  id: string;
  name: string;
  x: number;
  z: number;
  isLit: boolean;
  safeRadius: number;
}

export interface TriggerZoneData {
  id: string;
  act: number;
  x: number;
  z: number;
  radius: number;
  action: string;
  triggered: boolean;
}

export interface AABBBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  name?: string;
}

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
  name?: string;
}

// ── Trail Spline Calculation ──────────────────────────────────────────────────
// Smooth winding path from spawn (0, -155) to The Hollow (5, 145)
export const TRAIL_WAYPOINTS: Waypoint[] = [
  { x: 0, z: -160 },
  { x: 3, z: -135 },
  { x: 10, z: -105 }, // Near Lantern 1
  { x: 4, z: -75 },
  { x: -14, z: -45 }, // Beside Station 7 Porch
  { x: -5, z: -15 },
  { x: 14, z: 20 },   // Near Lantern 2
  { x: 6, z: 55 },
  { x: -18, z: 85 },  // Near Lantern 3
  { x: -8, z: 115 },
  { x: 5, z: 145 },   // The Hollow Clearing
];

export function getTrailX(z: number): number {
  if (z <= TRAIL_WAYPOINTS[0].z) return TRAIL_WAYPOINTS[0].x;
  if (z >= TRAIL_WAYPOINTS[TRAIL_WAYPOINTS.length - 1].z) {
    return TRAIL_WAYPOINTS[TRAIL_WAYPOINTS.length - 1].x;
  }

  for (let i = 0; i < TRAIL_WAYPOINTS.length - 1; i++) {
    const p0 = TRAIL_WAYPOINTS[i];
    const p1 = TRAIL_WAYPOINTS[i + 1];
    if (z >= p0.z && z <= p1.z) {
      const t = (z - p0.z) / (p1.z - p0.z);
      // Smooth cosine interpolation
      const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
      return p0.x + (p1.x - p0.x) * smoothT;
    }
  }
  return 0;
}

export function getTrailDistance(x: number, z: number): number {
  const tx = getTrailX(z);
  return Math.abs(x - tx);
}

// ── Clearings (No trees should spawn here) ────────────────────────────────────
export const LEVEL_CLEARINGS = [
  { x: 0, z: -160, radius: 15 },    // Spawn & Ranger Truck
  { x: 10, z: -105, radius: 8 },    // Lantern 1
  { x: -25, z: -45, radius: 20 },   // Station 7 Cabin & Yard
  { x: 14, z: 20, radius: 8 },      // Lantern 2
  { x: -18, z: 85, radius: 8 },     // Lantern 3
  { x: 5, z: 145, radius: 22 },     // The Hollow Clearing
];

export function isInsideClearing(x: number, z: number): boolean {
  for (const c of LEVEL_CLEARINGS) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < c.radius * c.radius) {
      return true;
    }
  }
  return false;
}

// ── Level Structures & Landmarks Data ─────────────────────────────────────────
export const LEVEL_DATA = {
  spawn: {
    x: 0,
    y: 0,
    z: -150,
    yaw: 0, // facing north (+Z)
  },

  truck: {
    x: -4.5,
    z: -160,
    rotY: -0.15,
  },

  gate: {
    x: 0,
    z: -168,
    width: 80,
  },

  cabin: {
    // Ranger Station 7 situated at (-25, -45)
    x: -25,
    z: -45,
    rotY: 0,
    width: 10,  // X extent
    length: 12, // Z extent
    height: 4.2,
    porchDepth: 3.5,
  },

  hollow: {
    x: 5,
    z: 145,
    radius: 18,
    grateRadius: 2.4,
  },

  lanterns: [
    {
      id: 'lantern_1',
      name: 'Lantern Post #1 (Trail South)',
      x: 10,
      z: -105,
      isLit: false,
      safeRadius: 8.0,
    },
    {
      id: 'lantern_2',
      name: 'Lantern Post #2 (Trail Mid)',
      x: 14,
      z: 20,
      isLit: false,
      safeRadius: 8.0,
    },
    {
      id: 'lantern_3',
      name: 'Lantern Post #3 (Trail North)',
      x: -18,
      z: 85,
      isLit: false,
      safeRadius: 8.0,
    },
    {
      id: 'lantern_4',
      name: 'Lantern Post #4 (The Hollow)',
      x: 9,
      z: 142,
      isLit: false,
      safeRadius: 8.0,
    },
  ] as LanternPostData[],

  // Distant warm guide glows scattered along the forest trail (matches reference image)
  guideGlows: [
    { x: 12, z: -104, yOffset: 2.8 },
    { x: -22, z: -43, yOffset: 2.5 },
    { x: 16, z: 21, yOffset: 2.8 },
    { x: -16, z: 86, yOffset: 2.8 },
    { x: 10, z: 143, yOffset: 2.8 },
  ],

  // Trigger zones for story & audio pacing
  triggers: [
    {
      id: 'trig_start_walk',
      act: 1,
      x: 0,
      z: -140,
      radius: 6,
      action: 'start_walk',
      triggered: false,
    },
    {
      id: 'trig_approach_station7',
      act: 2,
      x: -15,
      z: -45,
      radius: 8,
      action: 'approach_station7',
      triggered: false,
    },
    {
      id: 'trig_approach_hollow',
      act: 4,
      x: 5,
      z: 130,
      radius: 10,
      action: 'approach_hollow',
      triggered: false,
    },
  ] as TriggerZoneData[],

  // Objectives across the Acts (README Section 3)
  objectives: {
    act1: 'Follow the forest trail past the ranger gate',
    act2: 'Investigate Ranger Station 7 and restore power',
    act3: 'Relight the 3 forest Lantern Posts',
    act4: 'Survive the Hollow and seal the iron grate',
  },
};
