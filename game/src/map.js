// Yard 07 — the arena. Geometry (THREE) + colliders (plain AABBs, pure math, node-testable).
import * as THREE from 'three';

export const ARENA = { half: 22, wallH: 5 };
export const SPAWNS = {
  amber: [[-14, 18], [-6, 19], [6, 19], [14, 18]],
  cobalt: [[-14, -18], [-6, -19], [6, -19], [14, -18]],
};
export const RELAY = { x: 0, z: 0, r: 2.2 };

// [x, z, w, d, h, colour] — crates & containers. Mirrored so neither side has a cover advantage.
const PROPS = [
  [-16, 8, 4, 2, 2.4, 0x8a6d3b], [16, 8, 4, 2, 2.4, 0x8a6d3b],
  [-16, -8, 4, 2, 2.4, 0x8a6d3b], [16, -8, 4, 2, 2.4, 0x8a6d3b],
  [-8, 0, 6, 2, 2.6, 0x2e6f8e], [8, 0, 6, 2, 2.6, 0x2e6f8e],
  [0, 10, 3, 3, 1.4, 0x6b7280], [0, -10, 3, 3, 1.4, 0x6b7280],
  [-10, 14, 2, 2, 1.2, 0x6b7280], [10, 14, 2, 2, 1.2, 0x6b7280],
  [-10, -14, 2, 2, 1.2, 0x6b7280], [10, -14, 2, 2, 1.2, 0x6b7280],
  [-18, 0, 2, 5, 3.2, 0xb3541e], [18, 0, 2, 5, 3.2, 0xb3541e],
  [0, 16, 8, 1.5, 2.2, 0x374151], [0, -16, 8, 1.5, 2.2, 0x374151],
];

export function colliders() {
  const list = PROPS.map(([x, z, w, d, h]) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h }));
  const H = ARENA.half;
  list.push({ minX: -H - 1, maxX: -H, minZ: -H - 1, maxZ: H + 1, top: 99 });
  list.push({ minX: H, maxX: H + 1, minZ: -H - 1, maxZ: H + 1, top: 99 });
  list.push({ minX: -H - 1, maxX: H + 1, minZ: -H - 1, maxZ: -H, top: 99 });
  list.push({ minX: -H - 1, maxX: H + 1, minZ: H, maxZ: H + 1, top: 99 });
  return list;
}

// Circle (radius r) vs AABB in XZ — push the mover out. Returns corrected {x,z}.
export function resolveCircle(x, z, r, boxes) {
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-9) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
      else { // centre inside the box: push out along the smallest penetration axis
        const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r;
        else if (m === pt) z = b.minZ - r; else z = b.maxZ + r;
      }
    }
  }
  return { x, z };
}

// 2D segment (x0,z0)->(x1,z1) blocked by any box? Slab test. Used for bot line-of-sight.
export function segmentBlocked(x0, z0, x1, z1, boxes) {
  for (const b of boxes) {
    if (b.top < 1.2) continue; // low crates don't block sight over the top
    let tmin = 0, tmax = 1;
    const dx = x1 - x0, dz = z1 - z0;
    for (const [o, d, mn, mx] of [[x0, dx, b.minX, b.maxX], [z0, dz, b.minZ, b.maxZ]]) {
      if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { tmin = 1; tmax = 0; break; } }
      else {
        let t1 = (mn - o) / d, t2 = (mx - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) break;
      }
    }
    if (tmin <= tmax) return true;
  }
  return false;
}

function canvasTexture(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildMap(scene) {
  const H = ARENA.half;
  const groundTex = canvasTexture((g, s) => {
    g.fillStyle = '#3a3f46'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(0,0,0,.25)';
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * s / 8, 0); g.lineTo(i * s / 8, s); g.stroke(); g.beginPath(); g.moveTo(0, i * s / 8); g.lineTo(s, i * s / 8); g.stroke(); }
    g.fillStyle = 'rgba(245,197,66,.55)'; g.fillRect(s * 0.46, 0, s * 0.08, s); g.fillRect(0, s * 0.46, s, s * 0.08);
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * s, Math.random() * s, 3, 3);
  });
  groundTex.repeat.set(4, 4);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 });
  for (const [w, d, x, z] of [[H * 2 + 2, 1, 0, -H - 0.5], [H * 2 + 2, 1, 0, H + 0.5], [1, H * 2 + 2, -H - 0.5, 0], [1, H * 2 + 2, H + 0.5, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, ARENA.wallH, d), wallMat);
    m.position.set(x, ARENA.wallH / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  }
  for (const [x, z, w, d, h, col] of PROPS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
    m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.12, d + 0.06), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    edge.position.set(x, h + 0.02, z); scene.add(edge);
  }
  // Relay mast at mid — the objective.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 5, 8), new THREE.MeshStandardMaterial({ color: 0xf5c542, emissive: 0x332200, roughness: 0.4 }));
  mast.position.set(RELAY.x, 2.5, RELAY.z); mast.castShadow = true; scene.add(mast);
  const ring = new THREE.Mesh(new THREE.RingGeometry(RELAY.r - 0.25, RELAY.r, 32), new THREE.MeshBasicMaterial({ color: 0xf5c542, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(RELAY.x, 0.05, RELAY.z); scene.add(ring);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  beacon.position.set(RELAY.x, 5.4, RELAY.z); scene.add(beacon);

  scene.add(new THREE.HemisphereLight(0x8fa3c7, 0x1a1410, 0.9));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(18, 26, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26; sun.shadow.camera.right = 26; sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  scene.add(sun);
  scene.fog = new THREE.Fog(0x1a2230, 45, 90);
  return { mast, beacon, ring };
}
