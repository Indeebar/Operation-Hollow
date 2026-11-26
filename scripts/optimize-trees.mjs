import fs from 'node:fs';
import { execSync } from 'node:child_process';

fs.mkdirSync('tmp_trees', { recursive: true });
fs.mkdirSync('public/models', { recursive: true });

const jobs = [
  {
    src: 'https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/nature_pack/PineTree_1.glb',
    out: 'pine_1.glb',
  },
  {
    src: 'https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/nature_pack/PineTree_3.glb',
    out: 'pine_3.glb',
  },
  {
    src: 'https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/nature_pack/CommonTree_Dead_1.glb',
    out: 'dead_tree.glb',
  },
];

for (const j of jobs) {
  console.log(`Downloading ${j.out}...`);
  const res = await fetch(j.src);
  if (!res.ok) throw new Error(`${j.src} -> ${res.status}`);
  const raw = `tmp_trees/${j.out}`;
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  execSync(
    `npx @gltf-transform/cli optimize "${raw}" "public/models/${j.out}" --compress meshopt --simplify false --texture-compress webp --texture-size 1024`,
    { stdio: 'inherit' }
  );
}

fs.rmSync('tmp_trees', { recursive: true, force: true });
console.log('Done optimizing trees!');
