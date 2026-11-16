// Weapon table + spread/damage helpers. Pure logic, no DOM/THREE — node-testable.
export const WEAPONS = {
  p9:   { id: 'p9',   name: 'P9 Sidearm',    damage: 26, headMult: 2, mag: 12, reserve: Infinity, rpm: 320, spreadDeg: 0.6,  moveSpread: 1.4, price: 0,    auto: false, pellets: 1, range: 60, reloadMs: 1100 },
  vk47: { id: 'vk47', name: 'VK-47 Carbine', damage: 33, headMult: 2, mag: 30, reserve: 90,      rpm: 600, spreadDeg: 1.1,  moveSpread: 2.2, price: 2500, auto: true,  pellets: 1, range: 90, reloadMs: 2100 },
  s12:  { id: 's12',  name: 'S12 Scatter',   damage: 9,  headMult: 2, mag: 6,  reserve: 24,      rpm: 70,  spreadDeg: 4.5,  moveSpread: 3.0, price: 1700, auto: false, pellets: 8, range: 25, reloadMs: 2600 },
  lr90: { id: 'lr90', name: 'LR-90 Marksman',damage: 95, headMult: 2, mag: 5,  reserve: 15,      rpm: 45,  spreadDeg: 0.15, moveSpread: 4.5, price: 4000, auto: false, pellets: 1, range: 140, reloadMs: 3000 },
};
export const BUY_ORDER = ['p9', 'vk47', 's12', 'lr90'];

// Effective spread in degrees. Moving, airborne or spraying widens it; crouching / standing
// still and aiming slow tightens it. Accuracy counts more than speed — the core of the bounty.
export function effectiveSpreadDeg(w, { moving = false, airborne = false, crouched = false, shotsFired = 0 } = {}) {
  let s = w.spreadDeg;
  if (moving) s += w.moveSpread;
  if (airborne) s += 3.0;
  if (crouched) s *= 0.7;
  s += Math.min(shotsFired, 10) * 0.12; // spray bloom, resets when the trigger is released
  return s;
}

export function damageFalloff(w, dist) {
  if (dist <= w.range * 0.5) return 1;
  if (dist >= w.range) return 0.5;
  return 1 - 0.5 * ((dist - w.range * 0.5) / (w.range * 0.5));
}

export function shotDamage(w, dist, headshot) {
  return Math.round(w.damage * damageFalloff(w, dist) * (headshot ? w.headMult : 1));
}

export const ECONOMY = {
  startMoney: 800, killBonus: 300, roundWin: 1000, roundLoss: 700, relayWin: 1200,
  roundTarget: 5, maxRounds: 9, roundSeconds: 100, buySeconds: 15, relayHoldSeconds: 10,
};
