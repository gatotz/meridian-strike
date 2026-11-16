// Bot brain — pure functions over plain {x,z,hp,team} objects. No THREE/DOM: the caller injects
// a `blocked(x0,z0,x1,z1)` line-of-sight test. Node-testable.
import { ECONOMY } from './weapons.js';

export const WAYPOINTS = [
  [-16, 0], [16, 0], [0, 10], [0, -10], [-8, 14], [8, -14], [-14, -12], [14, 12],
];

export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

// Nearest visible, alive enemy. `blocked` is segmentBlocked from map.js.
export function chooseTarget(bot, enemies, blocked) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    if (!e.alive || e.hp <= 0) continue;
    const d = dist2(bot.x, bot.z, e.x, e.z);
    if (d >= bestD) continue;
    if (blocked(bot.x, bot.z, e.x, e.z)) continue;
    best = e; bestD = d;
  }
  return best;
}

// One decision tick (called ~10 Hz). Returns movement + aim + fire intent.
// Bot behaviour: push the Relay when behind on rounds, hold mid when ahead;
// strafe while engaging; burst fire (3–5 shots) then pause — no laser beams.
export function botDecision(bot, target, ctx) {
  const { time, scoreDiff, boxes } = ctx; // scoreDiff: own team rounds minus enemy rounds
  const out = { mx: 0, mz: 0, yaw: bot.yaw, fire: false, burst: 0 };
  if (!bot.alive) return out;
  if (!target) {
    // No sightline: head for the Relay (or the enemy side when ahead on rounds).
    const goal = scoreDiff >= 0 ? { x: 0, z: 0 } : { x: bot.team === 'amber' ? 0 : 0, z: bot.team === 'amber' ? -12 : 12 };
    const dx = goal.x - bot.x, dz = goal.z - bot.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.5) { out.mx = dx / d; out.mz = dz / d; out.yaw = Math.atan2(dx, dz); }
    return out;
  }
  const dx = target.x - bot.x, dz = target.z - bot.z;
  const d = Math.hypot(dx, dz);
  out.yaw = Math.atan2(dx, dz);
  // Keep a preferred fighting range; strafe sideways while engaging.
  const strafe = Math.sin(time * 1.7 + bot.id * 2.3) > 0 ? 1 : -1;
  const px = -dz / (d || 1), pz = dx / (d || 1); // perpendicular
  let fx = 0, fz = 0;
  if (d > 18) { fx = dx / d; fz = dz / d; }        // close the distance
  else if (d < 7) { fx = -dx / d; fz = -dz / d; }  // back off — don't hug the enemy
  out.mx = fx + px * 0.7 * strafe;
  out.mz = fz + pz * 0.7 * strafe;
  // Burst fire: 3–5 shots inside a ~0.9 s window, then a pause. Cycle length ~1.6 s.
  const cycle = (time + bot.id * 0.53) % 1.6;
  if (cycle < 0.9 && d < 45) {
    out.fire = true;
    out.burst = 3 + (bot.id % 3);
  }
  return out;
}

// Bot aim error in radians: grows with distance, target speed and the bot's own movement.
export function botAimErrorRad(dist, targetSpeed, botMoving) {
  let e = 0.012 + dist * 0.0011 + targetSpeed * 0.004;
  if (botMoving) e *= 1.6;
  return Math.min(e, 0.09);
}

// Relay hold: seconds a team has continuously held the point (game.js accumulates this).
export function relayProgress(holders, dt) { return holders * dt; }
export { ECONOMY };
