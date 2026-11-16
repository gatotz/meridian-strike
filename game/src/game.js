// MERIDIAN STRIKE — state machine, shooting, economy, HUD, minimap.
import * as THREE from 'three';
import { WEAPONS, BUY_ORDER, effectiveSpreadDeg, shotDamage, ECONOMY } from './weapons.js';
import { ARENA, SPAWNS, RELAY, colliders, resolveCircle, segmentBlocked, buildMap } from './map.js';
import { chooseTarget, botDecision, botAimErrorRad } from './bots.js';
import { sfx } from './audio.js';

const EYE = 1.62, BODY_R = 0.45, WALK = 5.2, CROUCH_WALK = 2.6;

function makeFighter(scene, id, team, isPlayer) {
  const colour = team === 'amber' ? 0xf5c542 : 0x3b82f6;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8 }));
  body.position.y = 0.95; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 }));
  head.position.y = 1.72; head.castShadow = true;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x111827 }));
  gun.position.set(0.3, 1.25, 0.3);
  g.add(body, head, gun);
  if (!isPlayer) scene.add(g);
  const f = { id, team, isPlayer, group: g, body, head, gun, x: 0, z: 0, yaw: 0, hp: 100, alive: true,
    weapon: 'p9', mag: WEAPONS.p9.mag, reserve: WEAPONS.p9.reserve, money: ECONOMY.startMoney,
    lastShot: 0, shotsFired: 0, reloading: 0, kills: 0, deaths: 0, speed: 0, crouched: false, moving: false };
  body.userData.fighter = f; body.userData.part = 'body';
  head.userData.fighter = f; head.userData.part = 'head';
  return f;
}

export class Game {
  constructor(appEl) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    appEl.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2230);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
    const { mast, beacon } = buildMap(this.scene);
    this.mast = mast; this.beacon = beacon;
    this.boxes = colliders();
    this.raycaster = new THREE.Raycaster();
    this.fighters = [];
    for (let i = 0; i < 4; i++) this.fighters.push(makeFighter(this.scene, i, 'amber', i === 0));
    for (let i = 0; i < 4; i++) this.fighters.push(makeFighter(this.scene, 4 + i, 'cobalt', false));
    this.player = this.fighters[0];
    this.hitMeshes = this.fighters.flatMap(f => [f.body, f.head]);
    this.state = 'menu'; // menu | buy | round | roundEnd | matchEnd
    this.score = { amber: 0, cobalt: 0 };
    this.round = 1;
    this.phaseT = 0; this.relayT = { amber: 0, cobalt: 0 };
    this.botClock = 0; this.decisions = new Map();
    this.keys = {};
    this.pitch = 0; this.yaw = 0;
    this.demo = new URLSearchParams(location.search).has('demo');
    this.autostart = new URLSearchParams(location.search).has('autostart');
    this.el = id => document.getElementById(id);
    this.bindHud();
    this.resetPositions();
    if (this.demo || this.autostart) this.startMatch();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  bindHud() {
    this.el('buyRows').innerHTML = BUY_ORDER.map((id, i) => {
      const w = WEAPONS[id];
      return `<div><span class="key">[${i + 1}]</span> ${w.name} — $${w.price} · ${w.damage} dmg · ${w.mag} rnd</div>`;
    }).join('') + `<div><span class="key">[B]</span> close</div>`;
  }

  resetPositions() {
    for (const f of this.fighters) {
      const s = SPAWNS[f.team][f.id % 4];
      f.x = s[0]; f.z = s[1]; f.hp = 100; f.alive = true;
      f.yaw = f.team === 'amber' ? 0 : Math.PI; // amber spawns south (z+) facing -z; cobalt faces +z
      if (f.isPlayer) { this.yaw = f.yaw; this.pitch = 0; }
      f.weapon = 'p9'; f.mag = WEAPONS.p9.mag; f.reserve = WEAPONS.p9.reserve;
      f.group.visible = !f.isPlayer; f.group.rotation.y = f.yaw; f.group.rotation.x = 0;
      f.group.position.set(f.x, 0, f.z);
    }
    this.relayT = { amber: 0, cobalt: 0 };
  }

  startMatch() {
    this.score = { amber: 0, cobalt: 0 }; this.round = 1;
    for (const f of this.fighters) f.money = ECONOMY.startMoney;
    this.el('menu').style.display = 'none';
    this.startBuy();
  }

  startBuy() {
    this.state = 'buy'; this.phaseT = ECONOMY.buySeconds;
    this.resetPositions();
    this.banner(`ROUND ${this.round}`, 'Buy phase — press B to shop, 1–4 to buy');
    this.el('buy').style.display = 'block';
  }

  startRound() {
    this.state = 'round'; this.phaseT = ECONOMY.roundSeconds;
    this.el('buy').style.display = 'none';
    this.banner(`ROUND ${this.round} — FIGHT`, 'Eliminate Cobalt, or hold the Relay 10 s');
    sfx.horn(true);
  }

  banner(big, sub, ms = 2200) {
    this.el('bannerBig').textContent = big; this.el('bannerSub').textContent = sub;
    this.el('banner').style.display = 'block';
    clearTimeout(this._bt); this._bt = setTimeout(() => { this.el('banner').style.display = 'none'; }, ms);
  }

  feed(msg) {
    const el = this.el('feed');
    const d = document.createElement('div'); d.textContent = msg;
    el.prepend(d); while (el.children.length > 5) el.lastChild.remove();
  }

  buy(id) {
    const p = this.player, w = WEAPONS[id];
    if (this.state !== 'buy') return;
    if (p.money < w.price) { sfx.denied(); this.feed(`Not enough money for ${w.name}`); return; }
    p.money -= w.price; p.weapon = id; p.mag = w.mag; p.reserve = w.reserve;
    sfx.buy(); this.feed(`Bought ${w.name} ($${w.price})`);
  }

  shoot(f, now) {
    const w = WEAPONS[f.weapon];
    if (f.mag <= 0 || f.reloading) return;
    const gap = 60000 / w.rpm;
    if (now - f.lastShot < gap) return;
    f.lastShot = now; f.mag--;
    f.shotsFired = (now - (f._burstStart || 0) > 400) ? 1 : f.shotsFired + 1;
    if (f.shotsFired === 1) f._burstStart = now;
    const spread = effectiveSpreadDeg(w, { moving: f.moving, crouched: f.crouched, shotsFired: f.shotsFired }) * Math.PI / 180;
    const origin = new THREE.Vector3(f.x, EYE, f.z);
    for (let p = 0; p < w.pellets; p++) {
      const yawErr = (Math.random() * 2 - 1) * spread, pitchErr = (Math.random() * 2 - 1) * spread;
      const baseYaw = f.isPlayer ? this.yaw : f.yaw;
      const basePitch = f.isPlayer ? this.pitch : 0;
      const dir = new THREE.Vector3(-Math.sin(baseYaw) * Math.cos(basePitch), Math.sin(basePitch), -Math.cos(baseYaw) * Math.cos(basePitch));
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawErr);
      const right = new THREE.Vector3(Math.cos(baseYaw), 0, -Math.sin(baseYaw));
      dir.applyAxisAngle(right, pitchErr);
      this.raycaster.set(origin, dir.normalize());
      this.raycaster.far = w.range;
      const hits = this.raycaster.intersectObjects(this.hitMeshes.filter(m => m.userData.fighter.alive && m.userData.fighter !== f), false);
      if (hits.length) {
        const h = hits[0], tf = h.object.userData.fighter;
        if (tf.team !== f.team) {
          const dist = h.distance, head = h.object.userData.part === 'head';
          const dmg = shotDamage(w, dist, head);
          this.damage(tf, dmg, f, head);
          if (f.isPlayer) { sfx.hit(); const hm = this.el('hit'); hm.style.display = 'block'; setTimeout(() => hm.style.display = 'none', 90); }
          break;
        }
      }
    }
    if (f.isPlayer) sfx.shot(f.weapon);
  }

  damage(target, dmg, attacker, head) {
    if (!target.alive) return;
    target.hp -= dmg;
    if (target.isPlayer) sfx.hurt();
    if (target.hp <= 0) {
      target.hp = 0; target.alive = false; target.deaths++;
      attacker.kills++; attacker.money += ECONOMY.killBonus;
      target.group.rotation.x = -Math.PI / 2; target.group.position.y = 0.3;
      this.feed(`${attacker.team === 'amber' ? 'AMBER' : 'COBALT'} ${attacker.id} ▸ ${target.team} ${target.id}${head ? ' (headshot)' : ''} · +$${ECONOMY.killBonus}`);
      if (attacker.isPlayer) sfx.kill();
      this.checkRoundEnd();
    }
  }

  checkRoundEnd() {
    if (this.state !== 'round') return;
    const a = this.fighters.filter(f => f.team === 'amber' && f.alive).length;
    const c = this.fighters.filter(f => f.team === 'cobalt' && f.alive).length;
    if (a === 0) this.endRound('cobalt', 'Cobalt eliminated Amber');
    else if (c === 0) this.endRound('amber', 'Amber eliminated Cobalt');
  }

  endRound(winner, reason) {
    if (this.state !== 'round') return;
    this.state = 'roundEnd'; this.phaseT = 4;
    if (winner) {
      this.score[winner]++;
      const bonus = reason.includes('Relay') ? ECONOMY.relayWin : ECONOMY.roundWin;
      for (const f of this.fighters) f.money += f.team === winner ? bonus : ECONOMY.roundLoss;
      this.banner(`${winner.toUpperCase()} TAKES ROUND ${this.round}`, reason);
      sfx.horn(winner === 'amber');
    } else {
      for (const f of this.fighters) f.money += ECONOMY.roundLoss;
      this.banner('DRAW', reason);
    }
  }

  nextAfterRound() {
    if (this.score.amber >= ECONOMY.roundTarget || this.score.cobalt >= ECONOMY.roundTarget || this.round >= ECONOMY.maxRounds) {
      this.state = 'matchEnd';
      const w = this.score.amber > this.score.cobalt ? 'AMBER' : this.score.cobalt > this.score.amber ? 'COBALT' : 'DRAW';
      this.banner(w === 'DRAW' ? 'DRAW' : `${w} WINS THE MATCH`, `Final score Amber ${this.score.amber} — ${this.score.cobalt} Cobalt · refresh to play again`, 6000);
      return;
    }
    this.round++;
    this.startBuy();
  }

  update(dt, now) {
    // Timers
    if (this.state === 'buy') { this.phaseT -= dt; if (this.phaseT <= 0) this.startRound(); }
    else if (this.state === 'round') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        const a = this.fighters.filter(f => f.team === 'amber' && f.alive).length;
        const c = this.fighters.filter(f => f.team === 'cobalt' && f.alive).length;
        this.endRound(a === c ? null : a > c ? 'amber' : 'cobalt', 'Time expired — most fighters standing wins');
      }
      // Relay hold: only counts when exactly one team is inside the ring.
      const inA = this.fighters.filter(f => f.alive && f.team === 'amber' && Math.hypot(f.x - RELAY.x, f.z - RELAY.z) < RELAY.r).length;
      const inC = this.fighters.filter(f => f.alive && f.team === 'cobalt' && Math.hypot(f.x - RELAY.x, f.z - RELAY.z) < RELAY.r).length;
      if (inA > 0 && inC === 0) { this.relayT.amber += dt; this.relayT.cobalt = 0; }
      else if (inC > 0 && inA === 0) { this.relayT.cobalt += dt; this.relayT.amber = 0; }
      else { this.relayT.amber = 0; this.relayT.cobalt = 0; }
      if (this.relayT.amber >= ECONOMY.relayHoldSeconds) this.endRound('amber', 'Amber held the Relay');
      if (this.relayT.cobalt >= ECONOMY.relayHoldSeconds) this.endRound('cobalt', 'Cobalt held the Relay');
    } else if (this.state === 'roundEnd') { this.phaseT -= dt; if (this.phaseT <= 0) this.nextAfterRound(); }

    // Bot decisions at 10 Hz
    this.botClock += dt;
    if (this.botClock >= 0.1) {
      this.botClock = 0;
      const blocked = (x0, z0, x1, z1) => segmentBlocked(x0, z0, x1, z1, this.boxes);
      for (const f of this.fighters) {
        if (f.isPlayer || !f.alive) continue;
        const enemies = this.fighters.filter(e => e.team !== f.team);
        const target = chooseTarget(f, enemies, blocked);
        const diff = (f.team === 'amber' ? this.score.amber - this.score.cobalt : this.score.cobalt - this.score.amber);
        this.decisions.set(f.id, { target, dec: botDecision(f, target, { time: now / 1000, scoreDiff: diff, boxes: this.boxes }) });
      }
    }

    // Movement + firing
    const p = this.player;
    if (this.state === 'round' || this.state === 'buy') {
      if (this.demo) {
        // Demo/screenshot mode: the bot brain pilots the player, so the game plays itself.
        this.stepBot(p, dt, now);
      } else {
        this.moveFighter(p, dt, this.playerInput());
        if (this.keys['KeyR'] && p.mag < WEAPONS[p.weapon].mag && !p.reloading) this.reload(p);
        if (this._firing) this.shoot(p, now);
      }
    }
    for (const f of this.fighters) {
      if (f.isPlayer || !f.alive) continue;
      this.stepBot(f, dt, now);
    }
    if (p.reloading && now >= p.reloading) {
      const w = WEAPONS[p.weapon];
      const need = w.mag - p.mag;
      const take = Math.min(need, p.reserve === Infinity ? need : p.reserve);
      p.mag += take; if (p.reserve !== Infinity) p.reserve -= take;
      p.reloading = 0;
    }

    // Camera follows the player (or orbits in demo/menu mode).
    if (this.demo && this.state === 'menu') {
      const t = now / 1000 * 0.12;
      this.camera.position.set(Math.sin(t) * 26, 14, Math.cos(t) * 26);
      this.camera.lookAt(0, 1, 0);
    } else {
      this.camera.position.set(p.x, EYE - (p.crouched ? 0.35 : 0), p.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
      p.yaw = this.yaw;
      p.group.position.set(p.x, 0, p.z);
    }
    this.beacon.position.y = 5.4 + Math.sin(now / 300) * 0.15;
    this.mast.rotation.y += dt * 0.4;
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  }

  playerInput() {
    const k = this.keys;
    let fx = 0, fz = 0;
    if (k['KeyW']) fz -= 1; if (k['KeyS']) fz += 1;
    if (k['KeyA']) fx -= 1; if (k['KeyD']) fx += 1;
    const slow = !!k['ShiftLeft'] || !!k['ShiftRight'];
    const crouched = !!k['KeyC'];
    return { fx, fz, slow, crouched };
  }

  // One bot step: move per the 10 Hz decision, fire with aim error. Also pilots the
  // player in demo mode. `decisions` holds the latest decision for non-player bots;
  // the demo player computes its decision on the fly.
  stepBot(f, dt, now) {
    if (!f.alive) return;
    let d = this.decisions.get(f.id);
    if (!d && f.isPlayer && this.demo) {
      const blocked = (x0, z0, x1, z1) => segmentBlocked(x0, z0, x1, z1, this.boxes);
      const target = chooseTarget(f, this.fighters.filter(e => e.team !== f.team), blocked);
      d = { target, dec: botDecision(f, target, { time: now / 1000, scoreDiff: 0, boxes: this.boxes }) };
    }
    if (!d) return;
    const sp = WALK * 0.62;
    const nx = f.x + d.dec.mx * sp * dt, nz = f.z + d.dec.mz * sp * dt;
    const r = resolveCircle(nx, nz, BODY_R, this.boxes);
    f.moving = Math.hypot(r.x - f.x, r.z - f.z) > 0.001;
    f.x = r.x; f.z = r.z; f.yaw = d.dec.yaw;
    f.group.position.set(f.x, 0, f.z); f.group.rotation.y = f.yaw;
    if (d.dec.fire && this.state === 'round' && d.target) {
      const err = botAimErrorRad(Math.hypot(d.target.x - f.x, d.target.z - f.z), d.target.speed || 0, f.moving);
      const saved = f.yaw; f.yaw += (Math.random() * 2 - 1) * err;
      this.shoot(f, now);
      f.yaw = saved;
    }
  }

  moveFighter(f, dt, input) {
    const w = WEAPONS[f.weapon];
    const speed = (input.crouched ? CROUCH_WALK : WALK) * (input.slow ? 0.5 : 1);
    const len = Math.hypot(input.fx, input.fz) || 1;
    const sin = Math.sin(f.yaw), cos = Math.cos(f.yaw);
    // Forward is -Z rotated by yaw; strafe is perpendicular.
    const mx = ((-input.fz / len) * -sin + (input.fx / len) * cos) * speed * dt;
    const mz = ((-input.fz / len) * -cos + (input.fx / len) * -sin) * speed * dt;
    const has = input.fx || input.fz;
    const nx = f.x + (has ? mx : 0), nz = f.z + (has ? mz : 0);
    const r = resolveCircle(nx, nz, BODY_R, this.boxes);
    f.moving = has && Math.hypot(r.x - f.x, r.z - f.z) > 0.0005;
    f.crouched = input.crouched;
    f.x = r.x; f.z = r.z;
    f.speed = f.moving ? speed : 0;
  }

  reload(f) {
    const w = WEAPONS[f.weapon];
    if (f.mag >= w.mag || f.reserve === 0) return;
    f.reloading = performance.now() + w.reloadMs;
    if (f.isPlayer) sfx.reload();
  }

  updateHud() {
    const p = this.player, w = WEAPONS[p.weapon];
    this.el('hpnum').textContent = Math.max(0, Math.ceil(p.hp));
    this.el('hpfill').style.width = `${Math.max(0, p.hp)}%`;
    this.el('mag').textContent = `${p.mag} / ${p.reserve === Infinity ? '∞' : p.reserve}`;
    this.el('wpn').textContent = w.name;
    const t = Math.max(0, Math.ceil(this.phaseT));
    this.el('timer').textContent = this.state === 'buy' ? `BUY ${t}s` : this.state === 'round' ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : this.state === 'menu' ? '—' : '';
    this.el('score').textContent = `AMBER ${this.score.amber} — ${this.score.cobalt} COBALT · ROUND ${this.round}`;
    this.el('money').textContent = `$${p.money}`;
    const rh = Math.max(this.relayT.amber, this.relayT.cobalt);
    this.el('relay').textContent = rh > 0 ? `RELAY ${rh.toFixed(1)}s / ${ECONOMY.relayHoldSeconds}s` : '';
    // Crosshair gap follows current spread.
    const sp = effectiveSpreadDeg(w, { moving: p.moving, crouched: p.crouched, shotsFired: p.shotsFired });
    const gap = 4 + sp * 2.2;
    for (const arm of document.querySelectorAll('#crosshair .arm')) {
      const a = arm.dataset.arm;
      arm.style.width = a === 't' || a === 'b' ? '2px' : '8px';
      arm.style.height = a === 'l' || a === 'r' ? '2px' : '8px';
      arm.style.left = a === 'l' ? `${11 - gap - 8}px` : a === 'r' ? `${11 + gap}px` : '10px';
      arm.style.top = a === 't' ? `${11 - gap - 8}px` : a === 'b' ? `${11 + gap}px` : '10px';
    }
    this.drawMinimap();
  }

  drawMinimap() {
    const c = this.el('minimap'); if (!c) return;
    const g = c.getContext('2d'); const S = 150, H = ARENA.half;
    const to = v => (v + H) / (H * 2) * S;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#111827'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#4b5563'; g.strokeRect(1, 1, S - 2, S - 2);
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(to(RELAY.x), to(RELAY.z), 4, 0, 7); g.fill();
    g.fillStyle = '#374151';
    for (const b of this.boxes) {
      if (b.top > 50) continue;
      g.fillRect(to(b.minX), to(b.minZ), Math.max(2, to(b.maxX) - to(b.minX)), Math.max(2, to(b.maxZ) - to(b.minZ)));
    }
    for (const f of this.fighters) {
      if (!f.alive) continue;
      g.fillStyle = f.isPlayer ? '#ffffff' : f.team === 'amber' ? '#f5c542' : '#3b82f6';
      g.beginPath(); g.arc(to(f.x), to(f.z), f.isPlayer ? 4 : 3, 0, 7); g.fill();
    }
  }
}
