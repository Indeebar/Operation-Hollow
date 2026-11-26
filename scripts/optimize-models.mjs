import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TMP_DIR = path.resolve('tmp_models');
const OUT_DIR = path.resolve('public/models');
fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const HEADERS = { 'User-Agent': 'OperationHollow/1.0' };

async function downloadFile(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function downloadPolyHavenGltf(id, subdir) {
  const dir = path.join(TMP_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const filesRes = await fetch(`https://api.polyhaven.com/files/${id}`, { headers: HEADERS }).then(r => r.json());
  const gltfEntry = filesRes.gltf?.['1k']?.gltf;
  if (!gltfEntry) throw new Error(`No 1k gltf for ${id}`);

  const gltfPath = path.join(dir, `${id}_1k.gltf`);
  console.log(`Downloading ${id} glTF...`);
  await downloadFile(gltfEntry.url, gltfPath);

  for (const [relPath, info] of Object.entries(gltfEntry.include || {})) {
    const dest = path.join(dir, relPath);
    await downloadFile(info.url, dest);
  }
  return gltfPath;
}

function runOptimize(inputPath, outputPath, ratio, error = 0.01) {
  const cmd = `npx @gltf-transform/cli optimize "${inputPath}" "${outputPath}" --compress meshopt --simplify true --simplify-ratio ${ratio} --simplify-error ${error} --texture-compress webp --texture-size 1024`;
  console.log(`Optimizing -> ${path.basename(outputPath)} (ratio=${ratio})`);
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  // 1. Truck from Kenney Starter-Kit-Racing (CC0)
  const truckRaw = path.join(TMP_DIR, 'truck_raw.glb');
  console.log('Downloading Kenney vehicle-truck-green.glb + colormap.png...');
  await downloadFile(
    'https://raw.githubusercontent.com/KenneyNL/Starter-Kit-Racing/main/models/vehicle-truck-green.glb',
    truckRaw
  );
  await downloadFile(
    'https://raw.githubusercontent.com/KenneyNL/Starter-Kit-Racing/main/models/Textures/colormap.png',
    path.join(TMP_DIR, 'Textures', 'colormap.png')
  );
  runOptimize(truckRaw, path.join(OUT_DIR, 'truck.glb'), 1.0, 0.001);

  // 2. Poly Haven models (CC0)
  const phJobs = [
    { id: 'bolt_action_rifle_7_62', out: 'rifle.glb', ratio: 0.35, error: 0.008 },
    { id: 'wooden_lantern_01', out: 'lantern.glb', ratio: 0.25, error: 0.015 },
    { id: 'portable_generator', out: 'generator.glb', ratio: 0.10, error: 0.025 },
    { id: 'metal_office_desk', out: 'desk.glb', ratio: 0.30, error: 0.015 },
    { id: 'vintage_day_bed', out: 'bed.glb', ratio: 0.85, error: 0.01 },
  ];

  for (const job of phJobs) {
    const gltfPath = await downloadPolyHavenGltf(job.id, job.id);
    runOptimize(gltfPath, path.join(OUT_DIR, job.out), job.ratio, job.error);
  }

  console.log('\nAll models optimized into public/models/!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
