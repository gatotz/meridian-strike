// MERIDIAN STRIKE — make.fun harness entry (threejs-fps-02).
// Runs under Node 22+ with no network. Writes game/, screenshots/ and dossier.json to
// /output, deterministically: two runs must produce identical bytes.
//
// Wired to the official kit: vendor/makefun-threejs.ts (sha256 f9622210…)
// copied unchanged from the threejs-fps-02 kit (https://make.fun/c/threejs-fps-02/kit),
// and the dossier is written by its buildDossier, as the starter's main.ts does.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? process.env.MAKEFUN_OUTPUT ?? '/output';

function main(): void {
  mkdirSync(join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });

  // 1. The playable game — static files, no build step, no network.
  cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });

  // 2. Screenshots: real renders of the game's own code, captured in desktop
  //    Chrome (WebGL 2). Only image files are copied verbatim, so repeated runs
  //    stay byte-identical; screenshots/README.md (notes, not an image) stays out.
  //    Pending: no screenshots yet — buildDossier refuses an entry without 3-4.
  const shots = existsSync(join(root, 'screenshots'))
    ? readdirSync(join(root, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
    : [];
  for (const f of shots) cpSync(join(root, 'screenshots', f), join(out, 'screenshots', f));

  // 3. Dossier — written by the kit's buildDossier from game/ + screenshots/.
  //    The scorer's own caps: only text_max_bytes shapes the bytes; the others
  //    refuse an entry the scorer would refuse.
  writeFileSync(
    join(out, 'dossier.json'),
    buildDossier(out, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
    }),
  );

  // Sanity: the game must reference only relative/mapped paths inside game/.
  const index = readFileSync(join(out, 'game', 'index.html'), 'utf8');
  if (!index.includes('./vendor/three.module.min.js')) throw new Error('import map missing vendored three.js');
  if (/https?:\/\//.test(index)) throw new Error('index.html must not reference the network');
  console.log(`wrote ${join(out, 'game')}, ${shots.length} screenshots, dossier.json`);
}

main();
