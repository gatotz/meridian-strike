// Bootstrap: input, pointer lock, game loop. Demo mode (?demo=1) runs without input.
import { Game } from './game.js';
import { BUY_ORDER } from './weapons.js';
import { sfx } from './audio.js';

const game = new Game(document.getElementById('app'));
const menu = document.getElementById('menu');
const buyEl = document.getElementById('buy');

let locked = false;
let last = performance.now();

function lockPointer() {
  if (game.demo) return;
  game.renderer.domElement.requestPointerLock?.();
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === game.renderer.domElement;
});
document.addEventListener('click', () => {
  if (game.state === 'menu') { game.startMatch(); lockPointer(); }
  else if (!locked && !game.demo) lockPointer();
});
document.addEventListener('mousemove', e => {
  if (!locked || game.state === 'menu') return;
  game.yaw -= e.movementX * 0.0021;
  game.pitch = Math.max(-1.45, Math.min(1.45, game.pitch - e.movementY * 0.0021));
});
document.addEventListener('mousedown', e => { if (e.button === 0 && locked) game._firing = true; });
document.addEventListener('mouseup', e => { if (e.button === 0) { game._firing = false; game.player.shotsFired = 0; } });
document.addEventListener('keydown', e => {
  game.keys[e.code] = true;
  if (e.code === 'KeyB' && game.state === 'buy') {
    buyEl.style.display = buyEl.style.display === 'none' ? 'block' : 'none';
    sfx.click();
  }
  if (game.state === 'buy') {
    const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (idx >= 0) game.buy(BUY_ORDER[idx]);
  }
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', e => { game.keys[e.code] = false; });

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt, now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
