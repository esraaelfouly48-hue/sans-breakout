/* ════════════════════════════════════════════════════════════════
   BREAKOUT: BOSS RUSH — Complete Game Logic
   ════════════════════════════════════════════════════════════════ */
'use strict';

// ──────────────────────────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────────────────────────
const CFG = {
  W: 800, H: 600,
  HUD_H: 38,
  BOSS_BAR_H: 26,
  PADDLE_Y_OFFSET: 30,          // px from bottom (above boss bar)
  PADDLE_W_BASE: 100,
  PADDLE_H: 12,
  BALL_R: 7,
  BALL_SPEED_BASE: 5.2,
  BALL_SPEED_MAX: 10,
  MAX_HP: 100,
  BALL_LOSS_HP: 10,
  BOMB_DEBUFF_HP: 15,
  PU_DURATION: 5,               // seconds
  BOSS_DURATION: 120,           // 2 minutes
  BROTHER_DURATION: 90,         // 1.5 minutes
  BLOCK_ROWS: 5,
  BLOCK_COLS: 10,
  BLOCK_W: 68,
  BLOCK_H: 20,
  BLOCK_PAD_X: 6,
  BLOCK_PAD_Y: 5,
  BLOCK_ORIGIN_X: 36,
  BLOCK_ORIGIN_Y: 50,
  PU_CHANCE: 0.22,              // 22% drop rate
  BLASTER_TELEGRAPH: 2.2,       // seconds warning
  BLASTER_FIRE: 0.55,           // seconds beam on
  BLASTER_W: 20,                // beam pixel width
  BLASTER_DMG: 15,
  ENDLESS_BROTHER_ROUND: 4,     // which round brother appears
};

// Block row colours (top → bottom)
const ROW_COLORS = ['#ff2222','#ff6600','#ffee00','#00ff88','#00ffff'];
const ROW_GLOW   = ['#ff0000','#ff4400','#ddcc00','#00dd66','#00dddd'];

// ──────────────────────────────────────────────────────────────────
//  DOM REFS
// ──────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
let canvas, ctx, pCanvas, pCtx;

// Initialize canvas refs after DOM loads
function initCanvasRefs() {
  canvas   = $('gameCanvas');
  ctx      = canvas.getContext('2d');
  pCanvas  = $('portrait-canvas');
  pCtx     = pCanvas.getContext('2d');
}

// ──────────────────────────────────────────────────────────────────
//  AUDIO
// ──────────────────────────────────────────────────────────────────
function makeAudio(src, loop = false) {
  const a = new Audio(src);
  a.loop = loop;
  return a;
}
const SND = {
  menu:    makeAudio('menu.ogg',           true),
  battle:  makeAudio('battle-start.mp3',   true),
  boss:    makeAudio('Megalovania.mp3',    true),
  talking: makeAudio('just-sans-talking.mp3', false),
};
let musicVol = 0.5, sfxVol = 0.5;
let menuAudioQueued = false;

function playMusic(key) {
  Object.values(SND).forEach(a => { if (a !== SND.talking) { a.pause(); a.currentTime = 0; } });
  const a = SND[key];
  if (!a) return;
  a.volume = musicVol;
  a.play().catch(() => { menuAudioQueued = (key === 'menu'); });
}
function stopMusic() {
  Object.values(SND).forEach(a => { if (a !== SND.talking) a.pause(); });
}
function playTalking() {
  try {
    const clone = SND.talking.cloneNode();
    clone.volume = Math.min(sfxVol * 0.35, 0.5);
    clone.playbackRate = 1.8;
    clone.play().catch(() => {});
  } catch(e) {}
}
function syncMusicVol() {
  ['menu','battle','boss'].forEach(k => {
    if (!SND[k].paused) SND[k].volume = musicVol;
  });
}

// ──────────────────────────────────────────────────────────────────
//  GAME STATE
// ──────────────────────────────────────────────────────────────────
const STATE = {
  MENU: 'MENU', PLAYING: 'PLAYING', TRANSITION: 'TRANSITION',
  BOSS: 'BOSS', CLIMAX: 'CLIMAX', ROSE_SCENE: 'ROSE_SCENE',
  ENDLESS: 'ENDLESS', BROTHER_INTRO: 'BROTHER_INTRO',
  BROTHER_BOSS: 'BROTHER_BOSS', BROTHER_CLIMAX: 'BROTHER_CLIMAX',
  GAMEOVER: 'GAMEOVER',
};

let state = STATE.MENU;
let platform = 'pc';

let hp = 100, score = 0, highScore = parseInt(localStorage.getItem('bbrHS') || '0');
let round = 1, endlessRound = 0;
let brotherFightDone = false;

// Paddle
const paddle = { x: CFG.W / 2, w: CFG.PADDLE_W_BASE, h: CFG.PADDLE_H, get y() {
  // sits above boss bar in boss phase, else near bottom
  return CFG.H - CFG.PADDLE_Y_OFFSET - (bossTimerActive ? CFG.BOSS_BAR_H : 0);
}};

// Balls array: { x, y, vx, vy, trail, extra, held, holdTimer, active }
let balls = [];

// Blocks: { x,y,w,h,hp,color,glow,row,broken }
let blocks = [];

// Power-ups: { x,y,vx,vy,type,active }
let powerUps = [];

// Particles: { x,y,vx,vy,life,maxLife,color,size }
let particles = [];

// Blasters: { x, phase:'telegraph'|'fire'|'done', timer, maxTimer, hasDamaged }
let blasters = [];

// Active effects
const effects = { slow: 0, bigPaddle: 0, extraBallTimer: 0 };

// Boss
let bossTimer = 0, bossMaxTimer = CFG.BOSS_DURATION;
let bossTimerActive = false;
let blasterSpawnTimer = 0, blasterSpawnInterval = 3;

// Shake & Flash
let shakeAmt = 0, shakeX = 0, shakeY = 0;
let flashColor = null, flashAlpha = 0;

// Keyboard
const keys = { left: false, right: false };

// Dialogue
const dlg = {
  active: false, queue: [], text: '', charIdx: 0,
  typeTimer: 0, typeSpeed: 0.038,
  name: '', portrait: 'bomb',
  onDone: null,
};

// Rose scene
let roseTimer = 0, roseX = 400, roseY = 250;
let roseParticles = [];

// Bomb/Brother animation state
let bombFloat = 0, brotherFloat = 0;
let bombX = 400, bombY = 180;
let brotherFightPhase = false;

// RAF
let rafId = null, lastTime = 0;

// ──────────────────────────────────────────────────────────────────
//  SCREEN FIT
// ──────────────────────────────────────────────────────────────────
function fitScreen() {
  const wrapper = $('wrapper');
  if (!wrapper) return;
  const s = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
  wrapper.style.transform = `scale(${s})`;
}

// ──────────────────────────────────────────────────────────────────
//  COORDINATE CONVERSION  (client → canvas, accounting for scale)
// ──────────────────────────────────────────────────────────────────
function clientToCanvas(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (cx - rect.left) * (CFG.W / rect.width),
    y: (cy - rect.top)  * (CFG.H / rect.height),
  };
}

// ──────────────────────────────────────────────────────────────────
//  INPUT
// ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  keys.left  = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if ((e.key === ' ' || e.key === 'Enter') && dlg.active) advanceDlg();
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft')  keys.left  = false;
  if (e.key === 'ArrowRight') keys.right = false;
});

canvas.addEventListener('mousemove', e => {
  if (platform !== 'pc') return;
  if (!isPlaying()) return;
  const { x } = clientToCanvas(e.clientX, e.clientY);
  paddle.x = x;
});

// Touch – drag anywhere on canvas
let touchStartX = 0;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (dlg.active) { advanceDlg(); return; }
  if (menuAudioQueued) { playMusic('menu'); menuAudioQueued = false; }
  const t = e.touches[0];
  touchStartX = t.clientX;
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!isPlaying()) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  touchStartX = t.clientX;
  paddle.x += dx / (window.innerWidth / CFG.W) * (CFG.W / window.innerWidth) *
    (CFG.W / canvas.getBoundingClientRect().width);
  // simpler: use absolute position
  const { x } = clientToCanvas(t.clientX, t.clientY);
  paddle.x = x;
}, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); }, { passive: false });

canvas.addEventListener('click', e => {
  if (menuAudioQueued) { playMusic('menu'); menuAudioQueued = false; }
  if (dlg.active) advanceDlg();
  // launch held balls
  balls.forEach(b => { if (b.held) launchBall(b); });
});

document.addEventListener('click', e => {
  if (menuAudioQueued) { playMusic('menu'); menuAudioQueued = false; }
});

function isPlaying() {
  return state === STATE.PLAYING || state === STATE.BOSS ||
         state === STATE.ENDLESS || state === STATE.BROTHER_BOSS;
}

// ──────────────────────────────────────────────────────────────────
//  BALL HELPERS
// ──────────────────────────────────────────────────────────────────
function makeBall(extra = false) {
  const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.6;
  const speed = extra ? CFG.BALL_SPEED_BASE * 0.9 : CFG.BALL_SPEED_BASE;
  return {
    x: paddle.x, y: paddle.y - CFG.BALL_R - 2,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    trail: [], extra, held: true, holdTimer: 0, active: true,
  };
}
function spawnBall(extra = false) {
  const b = makeBall(extra);
  balls.push(b);
  return b;
}
function launchBall(b) {
  if (!b.held) return;
  b.held = false;
  const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.5;
  const speed = CFG.BALL_SPEED_BASE * (effects.slow > 0 ? 0.55 : 1);
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
}
function resetPrimaryBall() {
  const pb = balls.find(b => !b.extra);
  if (pb) {
    pb.x = paddle.x; pb.y = paddle.y - CFG.BALL_R - 2;
    pb.vx = 0; pb.vy = 0;
    pb.held = true; pb.holdTimer = 0;
    pb.trail = [];
  } else {
    spawnBall(false);
  }
}
function ballSpeed(b) {
  return Math.sqrt(b.vx * b.vx + b.vy * b.vy);
}
function setBallSpeed(b, s) {
  const cur = ballSpeed(b);
  if (cur === 0) return;
  b.vx = (b.vx / cur) * s;
  b.vy = (b.vy / cur) * s;
}

// ──────────────────────────────────────────────────────────────────
//  BLOCK GENERATION
// ──────────────────────────────────────────────────────────────────
function generateBlocks(roundNum) {
  blocks = [];
  const rows = Math.min(CFG.BLOCK_ROWS + Math.floor(roundNum / 2), 8);
  const cols = CFG.BLOCK_COLS;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = CFG.BLOCK_ORIGIN_X + c * (CFG.BLOCK_W + CFG.BLOCK_PAD_X);
      const by = CFG.BLOCK_ORIGIN_Y + 38 + r * (CFG.BLOCK_H + CFG.BLOCK_PAD_Y);
      const rowIdx = r % ROW_COLORS.length;
      const hp2 = roundNum >= 4 && Math.random() < 0.4 ? 2 : 1;
      blocks.push({
        x: bx, y: by, w: CFG.BLOCK_W, h: CFG.BLOCK_H,
        hp: hp2, maxHp: hp2,
        color: ROW_COLORS[rowIdx], glow: ROW_GLOW[rowIdx],
        broken: false, flashTimer: 0,
      });
    }
  }
}
function blocksRemaining() {
  return blocks.filter(b => !b.broken).length;
}

// ──────────────────────────────────────────────────────────────────
//  POWER-UPS
// ──────────────────────────────────────────────────────────────────
const PU_TYPES = ['S', '🍄', '⭐', '💣'];
const PU_WEIGHTS = [0.3, 0.3, 0.25, 0.15];

function randomPUType() {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < PU_TYPES.length; i++) {
    acc += PU_WEIGHTS[i];
    if (r < acc) return PU_TYPES[i];
  }
  return PU_TYPES[0];
}
function spawnPowerUp(x, y) {
  powerUps.push({
    x, y, vx: (Math.random() - 0.5) * 1.5,
    vy: 1.8, type: randomPUType(), active: true, flashTimer: 0,
  });
}
function applyPowerUp(pu) {
  switch (pu.type) {
    case 'S':
      effects.slow = CFG.PU_DURATION;
      balls.forEach(b => { if (!b.held) setBallSpeed(b, CFG.BALL_SPEED_BASE * 0.55); });
      break;
    case '🍄':
      effects.bigPaddle = CFG.PU_DURATION;
      paddle.w = CFG.PADDLE_W_BASE * 1.85;
      break;
    case '⭐':
      effects.extraBallTimer = CFG.PU_DURATION;
      spawnBall(true);
      break;
    case '💣':
      loseHP(CFG.BOMB_DEBUFF_HP, '#ff6600');
      break;
  }
  updatePUBadges();
}
function updatePUBadges() {
  const wrap = $('pu-status');
  wrap.innerHTML = '';
  if (effects.slow > 0)       wrap.innerHTML += `<div class="pu-badge">S ${effects.slow.toFixed(1)}s</div>`;
  if (effects.bigPaddle > 0)  wrap.innerHTML += `<div class="pu-badge">🍄 ${effects.bigPaddle.toFixed(1)}s</div>`;
  if (effects.extraBallTimer > 0) wrap.innerHTML += `<div class="pu-badge">⭐ ${effects.extraBallTimer.toFixed(1)}s</div>`;
}

// ──────────────────────────────────────────────────────────────────
//  PARTICLES
// ──────────────────────────────────────────────────────────────────
function spawnBlockParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 3.5;
    particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: 1, maxLife: 1, color, size: 3 + Math.random() * 4,
    });
  }
}
function spawnHitParticles(x, y, color, n = 5) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 4;
    particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: 0.7, maxLife: 0.7, color, size: 2 + Math.random() * 3,
    });
  }
}

// ──────────────────────────────────────────────────────────────────
//  HP & DAMAGE
// ──────────────────────────────────────────────────────────────────
function loseHP(amount, col = '#ff2222') {
  hp = Math.max(0, hp - amount);
  updateHPBar();
  triggerShake(amount >= 15 ? 10 : 6);
  triggerFlash(col, 0.35);
  if (hp <= 0) enterGameOver();
}
function updateHPBar() {
  const pct = hp / CFG.MAX_HP;
  const fill = $('hp-bar-fill');
  fill.style.width = (pct * 100) + '%';
  fill.style.background = pct > 0.6 ? '#00ff88' : pct > 0.3 ? '#ffee00' : '#ff2222';
  fill.style.boxShadow = `0 0 6px ${fill.style.background}`;
  $('hp-text').textContent = hp + ' HP';
  if (pct <= 0.3 && pct > 0) {
    fill.style.animation = 'blink 0.5s step-end infinite';
  } else {
    fill.style.animation = 'none';
  }
}
function triggerShake(amt) { shakeAmt = amt; }
function triggerFlash(color, alpha) { flashColor = color; flashAlpha = alpha; }

// ──────────────────────────────────────────────────────────────────
//  SCORE
// ──────────────────────────────────────────────────────────────────
function addScore(pts) {
  score += pts;
  $('score-val').textContent = score;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('bbrHS', highScore);
    $('hi-val').textContent = highScore;
    $('menu-hi-val').textContent = highScore;
  }
}

// ──────────────────────────────────────────────────────────────────
//  BLASTERS (Boss)
// ──────────────────────────────────────────────────────────────────
function spawnBlaster(count = 1) {
  for (let i = 0; i < count; i++) {
    const margin = 60;
    const x = margin + Math.random() * (CFG.W - margin * 2);
    blasters.push({
      x, phase: 'telegraph', timer: 0,
      maxTimer: CFG.BLASTER_TELEGRAPH, hasDamaged: false,
      color: brotherFightPhase ? '#ff6600' : '#00ffff',
    });
  }
}
function updateBlasters(dt) {
  for (let i = blasters.length - 1; i >= 0; i--) {
    const bl = blasters[i];
    bl.timer += dt;
    if (bl.phase === 'telegraph' && bl.timer >= CFG.BLASTER_TELEGRAPH) {
      bl.phase = 'fire';
      bl.timer = 0;
      bl.maxTimer = CFG.BLASTER_FIRE;
    } else if (bl.phase === 'fire') {
      // Damage check
      if (!bl.hasDamaged) {
        const px = paddle.x, pw = paddle.w;
        if (Math.abs(bl.x - px) < (pw / 2 + CFG.BLASTER_W / 2)) {
          loseHP(CFG.BLASTER_DMG, '#ff00ff');
          bl.hasDamaged = true;
          spawnHitParticles(bl.x, paddle.y, '#ff00ff', 10);
        }
      }
      if (bl.timer >= CFG.BLASTER_FIRE) {
        bl.phase = 'done';
      }
    }
    if (bl.phase === 'done') {
      blasters.splice(i, 1);
    }
  }
}

// ──────────────────────────────────────────────────────────────────
//  COLLISION DETECTION
// ──────────────────────────────────────────────────────────────────
function moveBall(b, dt) {
  if (b.held) {
    b.x = paddle.x;
    b.y = paddle.y - CFG.BALL_R - 2;
    b.holdTimer += dt;
    if (b.holdTimer > 1.0) launchBall(b);  // auto-launch after 1s
    return;
  }

  // Trail
  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 10) b.trail.shift();

  b.x += b.vx;
  b.y += b.vy;

  const top = CFG.HUD_H + CFG.BALL_R;

  // Wall bounces
  if (b.x - CFG.BALL_R < 0) { b.x = CFG.BALL_R; b.vx = Math.abs(b.vx); }
  if (b.x + CFG.BALL_R > CFG.W) { b.x = CFG.W - CFG.BALL_R; b.vx = -Math.abs(b.vx); }
  if (b.y - CFG.BALL_R < top) { b.y = top + CFG.BALL_R; b.vy = Math.abs(b.vy); }

  // Paddle collision
  const py = paddle.y, pw = paddle.w, ph = paddle.h;
  const px = paddle.x;
  if (b.vy > 0 &&
    b.y + CFG.BALL_R >= py &&
    b.y - CFG.BALL_R <= py + ph &&
    b.x + CFG.BALL_R >= px - pw / 2 &&
    b.x - CFG.BALL_R <= px + pw / 2) {
    b.y = py - CFG.BALL_R;
    // Angle based on hit position
    const offset = (b.x - px) / (pw / 2);
    const angle = offset * (Math.PI / 3);
    const spd = Math.min(ballSpeed(b) + 0.05, CFG.BALL_SPEED_MAX);
    b.vx = Math.sin(angle) * spd;
    b.vy = -Math.abs(Math.cos(angle) * spd);
    spawnHitParticles(b.x, py, '#00ffff', 4);
  }

  // Block collisions
  if (state === STATE.PLAYING || state === STATE.ENDLESS) {
    for (const bl of blocks) {
      if (bl.broken) continue;
      const { hit, nx, ny } = ballVsRect(b, bl);
      if (hit) {
        bl.hp--;
        bl.flashTimer = 0.12;
        if (bl.hp <= 0) {
          bl.broken = true;
          spawnBlockParticles(bl.x + bl.w / 2, bl.y + bl.h / 2, bl.color);
          addScore(10 * round);
          if (Math.random() < CFG.PU_CHANCE) spawnPowerUp(bl.x + bl.w/2, bl.y + bl.h/2);
        }
        if (Math.abs(nx) > Math.abs(ny)) b.vx *= -1;
        else b.vy *= -1;
        break;
      }
    }
  }

  // Ball falls off bottom
  const bottomY = CFG.H - (bossTimerActive ? CFG.BOSS_BAR_H : 0);
  if (b.y - CFG.BALL_R > bottomY) {
    b.active = false;
    if (b.extra) return; // extra balls don't cost HP
    // Primary ball lost
    loseHP(CFG.BALL_LOSS_HP);
    if (hp > 0) resetPrimaryBall();
  }
}

function ballVsRect(b, rect) {
  const rx = rect.x, ry = rect.y, rw = rect.w, rh = rect.h;
  const closestX = Math.max(rx, Math.min(b.x, rx + rw));
  const closestY = Math.max(ry, Math.min(b.y, ry + rh));
  const dx = b.x - closestX, dy = b.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq < CFG.BALL_R * CFG.BALL_R) {
    const dist = Math.sqrt(distSq) || 0.001;
    return { hit: true, nx: dx / dist, ny: dy / dist };
  }
  return { hit: false };
}

// ──────────────────────────────────────────────────────────────────
//  DRAWING  — UTILITIES
// ──────────────────────────────────────────────────────────────────
function glow(color, blur = 14) {
  ctx.shadowBlur = blur; ctx.shadowColor = color;
}
function clearGlow() { ctx.shadowBlur = 0; }

// ── Background ────────────────────────────────────────────────────
function drawBackground() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CFG.W, CFG.H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CFG.W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CFG.H); ctx.stroke();
  }
  for (let y = 0; y <= CFG.H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CFG.W, y); ctx.stroke();
  }

  // HUD border line
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, CFG.HUD_H); ctx.lineTo(CFG.W, CFG.HUD_H); ctx.stroke();

  // Side walls glow
  ctx.strokeStyle = 'rgba(0,255,255,0.04)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, CFG.HUD_H); ctx.lineTo(0, CFG.H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CFG.W, CFG.HUD_H); ctx.lineTo(CFG.W, CFG.H); ctx.stroke();
}

// ── Paddle ────────────────────────────────────────────────────────
function drawPaddle() {
  const px = paddle.x - paddle.w / 2, py = paddle.y;
  const pw = paddle.w, ph = paddle.h;

  glow('#00ffff', 18);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = 'rgba(0,255,255,0.12)';
  ctx.fillRect(px, py, pw, ph);

  // Center line accent
  glow('#00ffff', 8);
  ctx.strokeStyle = 'rgba(0,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + pw/2, py + 2);
  ctx.lineTo(px + pw/2, py + ph - 2);
  ctx.stroke();

  clearGlow();
}

// ── Ball ──────────────────────────────────────────────────────────
function drawBall(b) {
  if (!b.active) return;

  // Trail
  b.trail.forEach((pt, i) => {
    const alpha = (i / b.trail.length) * 0.5;
    const r = CFG.BALL_R * (i / b.trail.length) * 0.8;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = b.extra ? `rgba(255,200,0,${alpha})` : `rgba(0,255,255,${alpha})`;
    ctx.fill();
  });

  // Ball
  const col = b.extra ? '#ffee00' : '#ffffff';
  const glowCol = b.extra ? '#ffaa00' : '#00ffff';
  glow(glowCol, 20);
  ctx.beginPath();
  ctx.arc(b.x, b.y, CFG.BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  clearGlow();

  // Launch indicator
  if (b.held) {
    glow(glowCol, 6);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = `${glowCol}80`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x, CFG.HUD_H + 40);
    ctx.stroke();
    ctx.setLineDash([]);
    clearGlow();
  }
}

// ── Blocks ────────────────────────────────────────────────────────
function drawBlocks() {
  for (const bl of blocks) {
    if (bl.broken) continue;
    const flash = bl.flashTimer > 0;

    if (flash) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
    } else {
      const dmgPct = bl.hp / bl.maxHp;
      glow(bl.glow, 8);
      ctx.fillStyle = bl.color + (dmgPct < 1 ? '99' : '');
      ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
      ctx.strokeStyle = bl.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(bl.x, bl.y, bl.w, bl.h);
      // HP cracks
      if (bl.maxHp > 1 && bl.hp < bl.maxHp) {
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bl.x + 5, bl.y + bl.h/2);
        ctx.lineTo(bl.x + bl.w - 5, bl.y + bl.h/2);
        ctx.stroke();
      }
    }
    clearGlow();
  }
}

// ── Power-ups ─────────────────────────────────────────────────────
function drawPowerUps() {
  for (const pu of powerUps) {
    if (!pu.active) continue;
    const isDebuff = pu.type === '💣';
    const col = isDebuff ? '#ff6600' : '#ffee00';
    glow(col, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(pu.x - 14, pu.y - 10, 28, 20);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pu.x - 14, pu.y - 10, 28, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.type, pu.x, pu.y);
    clearGlow();
  }
}

// ── Particles ─────────────────────────────────────────────────────
function drawParticles() {
  for (const p of particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    glow(p.color, 6);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    clearGlow();
  }
  ctx.globalAlpha = 1;
}

// ── Blasters ──────────────────────────────────────────────────────
function drawBlasters(t) {
  for (const bl of blasters) {
    const topY = CFG.HUD_H;
    const botY = CFG.H - (bossTimerActive ? CFG.BOSS_BAR_H : 0);

    if (bl.phase === 'telegraph') {
      // Vibrating faint line
      const vib = Math.sin(t * 25) * 2;
      ctx.strokeStyle = `rgba(255,255,0,0.3)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(bl.x + vib, topY);
      ctx.lineTo(bl.x + vib, botY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Warning chevrons
      ctx.fillStyle = 'rgba(255,220,0,0.5)';
      ctx.font = '10px ' + "'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('▼', bl.x, topY + 4);
      ctx.textBaseline = 'bottom';
      ctx.fillText('▲', bl.x, botY - 4);

    } else if (bl.phase === 'fire') {
      const progress = bl.timer / bl.maxTimer;

      // Outer glow beam
      const col = bl.color === '#ff6600' ? 'rgba(255,80,0,' : 'rgba(0,255,255,';
      glow(bl.color, 40);
      ctx.fillStyle = col + '0.12)';
      ctx.fillRect(bl.x - CFG.BLASTER_W * 1.5, topY, CFG.BLASTER_W * 3, botY - topY);

      // Core beam
      glow(bl.color, 25);
      const grad = ctx.createLinearGradient(bl.x - CFG.BLASTER_W/2, 0, bl.x + CFG.BLASTER_W/2, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.3, bl.color);
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(0.7, bl.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(bl.x - CFG.BLASTER_W/2, topY, CFG.BLASTER_W, botY - topY);

      // Chromatic aberration
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(bl.x - CFG.BLASTER_W/2 - 3, topY, CFG.BLASTER_W, botY - topY);
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(bl.x - CFG.BLASTER_W/2 + 3, topY, CFG.BLASTER_W, botY - topY);
      ctx.globalAlpha = 1;

      clearGlow();
    }
  }
  ctx.textAlign = 'left';
}

// ── Flash Overlay ─────────────────────────────────────────────────
function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.fillStyle = flashColor;
  ctx.globalAlpha = flashAlpha;
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.globalAlpha = 1;
}

// ──────────────────────────────────────────────────────────────────
//  PIXEL ART CHARACTERS
// ──────────────────────────────────────────────────────────────────
function drawBombOnCanvas(targetCtx, cx, cy, size, angry, t) {
  const tc = targetCtx;
  tc.save();

  // Glow
  const glowCol = angry ? '#ff4400' : '#ffdd00';
  tc.shadowBlur = 20; tc.shadowColor = glowCol;

  // Body
  tc.beginPath();
  tc.arc(cx, cy, size, 0, Math.PI * 2);
  tc.fillStyle = angry ? '#1a0800' : '#111118';
  tc.fill();
  tc.strokeStyle = glowCol;
  tc.lineWidth = 3;
  tc.stroke();

  // Highlight shine
  tc.beginPath();
  tc.arc(cx - size * 0.3, cy - size * 0.3, size * 0.18, 0, Math.PI * 2);
  tc.fillStyle = 'rgba(255,255,255,0.15)';
  tc.fill();

  // Fuse (curvy line)
  tc.shadowBlur = 6; tc.shadowColor = '#888';
  tc.strokeStyle = '#aaaaaa';
  tc.lineWidth = 2.5;
  tc.lineCap = 'round';
  tc.beginPath();
  tc.moveTo(cx, cy - size);
  tc.bezierCurveTo(
    cx + size * 0.6, cy - size - 10,
    cx + size * 0.9, cy - size - 5,
    cx + size * 1.1, cy - size - 20
  );
  tc.stroke();

  // Spark at fuse tip
  const sparkX = cx + size * 1.1, sparkY = cy - size - 20;
  tc.shadowBlur = 14; tc.shadowColor = '#ffaa00';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t * 8;
    const r = 3 + Math.sin(t * 12 + i) * 2;
    tc.beginPath();
    tc.arc(sparkX + Math.cos(a) * r, sparkY + Math.sin(a) * r, 1.5, 0, Math.PI * 2);
    tc.fillStyle = i % 2 === 0 ? '#ff8800' : '#ffdd00';
    tc.fill();
  }

  // Eyes
  const eyeY = cy - size * 0.12;
  const eyeOffX = size * 0.28;
  const eyeR = size * 0.13;
  tc.shadowBlur = 10; tc.shadowColor = angry ? '#ff0000' : '#00ffff';
  [eyeOffX, -eyeOffX].forEach(ox => {
    tc.beginPath();
    tc.arc(cx + ox, eyeY, eyeR, 0, Math.PI * 2);
    tc.fillStyle = angry ? '#ff2200' : '#00ffff';
    tc.fill();
    // Pupil
    tc.beginPath();
    tc.arc(cx + ox + (angry ? -1 : 0), eyeY, eyeR * 0.45, 0, Math.PI * 2);
    tc.fillStyle = '#000';
    tc.fill();
  });

  // Eyebrows (always angry for boss)
  if (angry) {
    tc.shadowBlur = 0;
    tc.strokeStyle = '#ff3300';
    tc.lineWidth = 2.5;
    tc.lineCap = 'round';
    // Left brow (angled down toward center = angry)
    tc.beginPath();
    tc.moveTo(cx - eyeOffX - eyeR * 1.2, eyeY - eyeR * 1.6);
    tc.lineTo(cx - eyeOffX + eyeR * 0.5, eyeY - eyeR * 0.9);
    tc.stroke();
    // Right brow
    tc.beginPath();
    tc.moveTo(cx + eyeOffX + eyeR * 1.2, eyeY - eyeR * 1.6);
    tc.lineTo(cx + eyeOffX - eyeR * 0.5, eyeY - eyeR * 0.9);
    tc.stroke();
  }

  // Mouth
  tc.shadowBlur = 6; tc.shadowColor = glowCol;
  tc.strokeStyle = glowCol;
  tc.lineWidth = 2;
  const mouthY = cy + size * 0.3;
  const mouthR = size * 0.28;
  tc.beginPath();
  if (angry) {
    // Angry jagged grin
    const teeth = 5;
    tc.moveTo(cx - mouthR, mouthY);
    for (let i = 0; i <= teeth; i++) {
      const tx2 = cx - mouthR + (i / teeth) * mouthR * 2;
      const ty2 = mouthY + (i % 2 === 0 ? 0 : mouthR * 0.35);
      tc.lineTo(tx2, ty2);
    }
    tc.stroke();
  } else {
    // Smug grin
    tc.arc(cx, mouthY - mouthR * 0.3, mouthR, 0.3, Math.PI - 0.3);
    tc.stroke();
  }

  tc.restore();
}

// Brother bomb – bigger, red, battle-damaged
function drawBombBrotherOnCanvas(targetCtx, cx, cy, size, t) {
  const tc = targetCtx;
  tc.save();

  // BIGGER, REDDER, MEANER
  tc.shadowBlur = 24; tc.shadowColor = '#ff2200';

  // Body
  tc.beginPath();
  tc.arc(cx, cy, size, 0, Math.PI * 2);
  tc.fillStyle = '#1e0000';
  tc.fill();
  tc.strokeStyle = '#ff2200';
  tc.lineWidth = 3.5;
  tc.stroke();

  // Red bandana across upper body
  tc.shadowBlur = 0;
  tc.beginPath();
  tc.arc(cx, cy, size, Math.PI * 1.05, Math.PI * 1.95);
  tc.strokeStyle = '#cc0000';
  tc.lineWidth = 6;
  tc.stroke();

  // Bandana knot on right
  tc.beginPath();
  tc.ellipse(cx + size * 0.85, cy + size * 0.1, 6, 4, 0.5, 0, Math.PI * 2);
  tc.fillStyle = '#cc0000';
  tc.fill();

  // Battle scar (diagonal line on left)
  tc.shadowBlur = 4; tc.shadowColor = '#ff8888';
  tc.strokeStyle = '#ff6666';
  tc.lineWidth = 2;
  tc.beginPath();
  tc.moveTo(cx - size * 0.55, cy - size * 0.5);
  tc.lineTo(cx - size * 0.25, cy - size * 0.1);
  tc.stroke();

  // Fuse (shorter, smoking)
  tc.shadowBlur = 6; tc.shadowColor = '#888';
  tc.strokeStyle = '#888';
  tc.lineWidth = 3;
  tc.lineCap = 'round';
  tc.beginPath();
  tc.moveTo(cx + size * 0.1, cy - size * 0.95);
  tc.bezierCurveTo(cx + size * 0.5, cy - size - 8, cx + size * 0.7, cy - size - 2, cx + size * 0.9, cy - size - 15);
  tc.stroke();

  // ANGRY RED eyes
  const eyeY = cy - size * 0.1;
  const eyeOffX = size * 0.3;
  const eyeR = size * 0.155;
  tc.shadowBlur = 14; tc.shadowColor = '#ff0000';
  [eyeOffX, -eyeOffX].forEach(ox => {
    tc.beginPath();
    tc.arc(cx + ox, eyeY, eyeR, 0, Math.PI * 2);
    tc.fillStyle = '#ff0000';
    tc.fill();
    tc.beginPath();
    tc.arc(cx + ox - 1, eyeY + 1, eyeR * 0.5, 0, Math.PI * 2);
    tc.fillStyle = '#000';
    tc.fill();
  });

  // Slanted FURIOUS eyebrows
  tc.shadowBlur = 0;
  tc.strokeStyle = '#ff4400';
  tc.lineWidth = 3;
  tc.lineCap = 'round';
  tc.beginPath();
  tc.moveTo(cx - eyeOffX - eyeR * 1.4, eyeY - eyeR * 1.8);
  tc.lineTo(cx - eyeOffX + eyeR * 0.3, eyeY - eyeR * 0.7);
  tc.stroke();
  tc.beginPath();
  tc.moveTo(cx + eyeOffX + eyeR * 1.4, eyeY - eyeR * 1.8);
  tc.lineTo(cx + eyeOffX - eyeR * 0.3, eyeY - eyeR * 0.7);
  tc.stroke();

  // Jagged rage-mouth
  tc.shadowBlur = 8; tc.shadowColor = '#ff3300';
  tc.strokeStyle = '#ff3300';
  tc.lineWidth = 2.5;
  const mY = cy + size * 0.28;
  const mR = size * 0.35;
  tc.beginPath();
  tc.moveTo(cx - mR, mY);
  for (let i = 0; i <= 6; i++) {
    const tx2 = cx - mR + (i / 6) * mR * 2;
    const ty2 = mY + (i % 2 === 0 ? 4 : mY * 0 + size * 0.15);
    tc.lineTo(tx2, ty2);
  }
  tc.stroke();

  // "B.B" text label
  tc.shadowBlur = 0;
  tc.fillStyle = 'rgba(255,80,0,0.6)';
  tc.font = `bold ${Math.floor(size * 0.28)}px monospace`;
  tc.textAlign = 'center';
  tc.textBaseline = 'middle';
  tc.fillText('B.B', cx, cy + size * 0.05);

  tc.restore();
}

// ── Rose ──────────────────────────────────────────────────────────
function drawRose(cx, cy, size, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);

  glow('#ff4466', 20);

  // Petals
  const numPetals = 6;
  for (let i = 0; i < numPetals; i++) {
    const angle = (i / numPetals) * Math.PI * 2 + t * 0.3;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.55, size * 0.28, size * 0.45, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(0, -size * 0.55, 0, 0, -size * 0.55, size * 0.45);
    grad.addColorStop(0, '#ff6688');
    grad.addColorStop(1, '#cc0033');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // Inner petals
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + t * 0.5 + Math.PI / 4;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.3, size * 0.2, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3355';
    ctx.fill();
    ctx.restore();
  }

  // Center
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = '#ff0044';
  ctx.fill();

  clearGlow();

  // Stem
  ctx.strokeStyle = '#00bb44';
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 4; ctx.shadowColor = '#00ff88';
  ctx.beginPath();
  ctx.moveTo(0, size * 0.15);
  ctx.lineTo(0, size * 2.2);
  ctx.stroke();

  // Leaves
  ctx.fillStyle = '#00aa33';
  ctx.beginPath();
  ctx.ellipse(-size * 0.3, size * 1.0, size * 0.28, size * 0.14, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.3, size * 1.5, size * 0.28, size * 0.14, 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
//  DIALOGUE SYSTEM
// ──────────────────────────────────────────────────────────────────
function startDialogue(lines, portrait, name, onDone) {
  dlg.active = true;
  dlg.queue = [...lines];
  dlg.portrait = portrait;
  dlg.name = name;
  dlg.onDone = onDone;
  $('dlg-name').textContent = name;
  $('dialogue-overlay').style.display = 'flex';
  drawPortrait(portrait, 0);
  showNextDlgLine();
}

function showNextDlgLine() {
  if (dlg.queue.length === 0) { endDialogue(); return; }
  dlg.text = dlg.queue.shift();
  dlg.charIdx = 0;
  dlg.typeTimer = 0;
  $('dlg-text').textContent = '';
}

function updateDialogue(dt) {
  if (!dlg.active) return;
  if (dlg.charIdx < dlg.text.length) {
    dlg.typeTimer += dt;
    while (dlg.typeTimer >= dlg.typeSpeed && dlg.charIdx < dlg.text.length) {
      dlg.typeTimer -= dlg.typeSpeed;
      dlg.charIdx++;
      $('dlg-text').textContent = dlg.text.slice(0, dlg.charIdx);
      if (dlg.charIdx % 2 === 0) playTalking();
    }
  }
}

function advanceDlg() {
  if (!dlg.active) return;
  if (dlg.charIdx < dlg.text.length) {
    dlg.charIdx = dlg.text.length;
    $('dlg-text').textContent = dlg.text;
  } else {
    showNextDlgLine();
  }
}

function endDialogue() {
  dlg.active = false;
  $('dialogue-overlay').style.display = 'none';
  if (dlg.onDone) dlg.onDone();
}

function drawPortrait(which, t) {
  pCtx.clearRect(0, 0, 80, 80);
  if (which === 'bomb') {
    drawBombOnCanvas(pCtx, 40, 42, 28, true, t);
  } else if (which === 'brother') {
    drawBombBrotherOnCanvas(pCtx, 40, 42, 28, t);
  }
}

// ──────────────────────────────────────────────────────────────────
//  STATE MACHINE
// ──────────────────────────────────────────────────────────────────
function enterMenu() {
  state = STATE.MENU;
  $('menu').style.display = 'flex';
  $('gameCanvas').style.display = 'none';
  $('hud').style.display = 'none';
  $('boss-timer-wrap').style.display = 'none';
  hideOverlays();
  $('menu-hi-val').textContent = highScore;
  playMusic('menu');
}

function startGame(plat) {
  platform = plat;
  hp = 100; score = 0; round = 1; endlessRound = 0;
  brotherFightDone = false;
  effects.slow = 0; effects.bigPaddle = 0; effects.extraBallTimer = 0;
  paddle.w = CFG.PADDLE_W_BASE;
  balls = []; particles = []; powerUps = []; blasters = [];
  bossTimerActive = false;
  $('menu').style.display = 'none';
  $('gameCanvas').style.display = 'block';
  $('hud').style.display = 'flex';
  $('boss-timer-wrap').style.display = 'none';
  $('score-val').textContent = '0';
  $('hi-val').textContent = highScore;
  $('round-label').textContent = 'ROUND 1';
  updateHPBar();
  generateBlocks(round);
  spawnBall();
  stopMusic();
  playMusic('battle');
  state = STATE.PLAYING;
}

function onAllBlocksCleared() {
  if (state === STATE.PLAYING && round < 3) {
    // Continue to next round
    round++;
    $('round-label').textContent = `ROUND ${round}`;
    generateBlocks(round);
  } else if (state === STATE.PLAYING && round === 3) {
    // Boss time!
    state = STATE.TRANSITION;
    stopMusic();
    beginBombDialogue();
  } else if (state === STATE.ENDLESS) {
    endlessRound++;
    if (!brotherFightDone && endlessRound >= CFG.ENDLESS_BROTHER_ROUND - 1) {
      state = STATE.BROTHER_INTRO;
      stopMusic();
      beginBrotherDialogue();
    } else {
      // Next endless round
      round++;
      $('round-label').textContent = `ROUND ${round}`;
      generateBlocks(round);
    }
  }
}

// ─── BOMB TRANSITION DIALOGUE ─────────────────────────────────────
function beginBombDialogue() {
  bombX = 400; bombY = 240;
  const lines = [
    "...",
    "So you cleared my little obstacle course.",
    "Impressive... for a HUMAN.",
    "Allow me to introduce myself properly.",
    "I am THE BOMB.\nAnd today... I end this.",
    "Survive my blasters for 2 minutes.\nIF you can.",
    "The clock starts NOW.",
  ];
  startDialogue(lines, 'bomb', '— THE BOMB —', enterBossPhase);
}

// ─── BOSS PHASE ───────────────────────────────────────────────────
function enterBossPhase() {
  state = STATE.BOSS;
  bossTimerActive = true;
  bossTimer = CFG.BOSS_DURATION;
  bossMaxTimer = CFG.BOSS_DURATION;
  blasterSpawnInterval = 3;
  blasterSpawnTimer = 1;
  blasters = [];
  brotherFightPhase = false;

  // Keep ball alive
  balls = balls.filter(b => !b.extra && b.active);
  if (balls.length === 0) spawnBall();
  balls.forEach(b => { b.held = true; b.holdTimer = 0; });

  $('boss-timer-wrap').style.display = 'flex';
  $('boss-timer-text').textContent = '2:00';
  $('boss-timer-fill').style.width = '100%';
  playMusic('boss');
}

// ─── CLIMAX ───────────────────────────────────────────────────────
function enterClimax() {
  state = STATE.CLIMAX;
  stopMusic();
  bossTimerActive = false;
  $('boss-timer-wrap').style.display = 'none';
  blasters = [];
  $('climax-msg').textContent = '— THE MOMENT OF TRUTH —';
  $('climax-sub').textContent = 'What will you do?';
  $('climax-overlay').style.display = 'flex';
}

function doSpare() {
  $('climax-overlay').style.display = 'none';
  alert('You spared the bomb.\nPerhaps there is still mercy in this world...');
  location.reload();
}

function doFight() {
  $('climax-overlay').style.display = 'none';
  enterRoseScene();
}

// ─── ROSE SCENE ───────────────────────────────────────────────────
function enterRoseScene() {
  state = STATE.ROSE_SCENE;
  roseTimer = 0;
  roseX = CFG.W / 2;
  roseY = CFG.H / 2 - 40;
  roseParticles = [];
  bombX = -200; // bomb flies off
}

function updateRoseScene(dt) {
  roseTimer += dt;
  // Rose floats down from above, glows, then petals scatter
  if (roseTimer < 1.5) {
    roseY = Math.max(CFG.H / 2 - 40, CFG.H / 2 - 40 - (1 - roseTimer / 1.5) * 120);
  }
  if (roseTimer > 2.5 && roseTimer < 3.5) {
    if (roseParticles.length < 30) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        roseParticles.push({
          x: roseX, y: roseY, vx: Math.cos(a) * (2 + Math.random() * 4),
          vy: Math.sin(a) * (2 + Math.random() * 4) - 2,
          life: 1, maxLife: 1, color: '#ff4466', size: 4 + Math.random() * 6,
        });
      }
    }
    for (const rp of roseParticles) {
      rp.x += rp.vx; rp.y += rp.vy; rp.vy += 0.08;
      rp.life -= dt * 1.2;
    }
  }
  if (roseTimer > 4.0) {
    enterEndless();
  }
}

function drawRoseScene(t) {
  drawBackground();
  // Epic centered text
  if (roseTimer > 0.5 && roseTimer < 2.2) {
    const alpha = Math.min(1, (roseTimer - 0.5) * 2);
    ctx.globalAlpha = alpha;
    glow('#ff4466', 20);
    ctx.fillStyle = '#ff4466';
    ctx.font = '14px ' + "'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU CHOSE TO FIGHT', CFG.W / 2, CFG.H / 2 + 80);
    ctx.globalAlpha = 1;
    clearGlow();
  }
  const alpha2 = roseTimer < 0.5 ? roseTimer * 2 : roseTimer > 3.5 ? Math.max(0, 1 - (roseTimer - 3.5) * 2) : 1;
  drawRose(roseX, roseY, 28, t, alpha2);
  // Scattered petals
  for (const rp of roseParticles) {
    ctx.globalAlpha = Math.max(0, rp.life);
    ctx.fillStyle = rp.color;
    glow(rp.color, 6);
    ctx.fillRect(rp.x - rp.size/2, rp.y - rp.size/2, rp.size, rp.size);
    ctx.globalAlpha = 1;
    clearGlow();
  }
}

// ─── ENDLESS MODE ─────────────────────────────────────────────────
function enterEndless() {
  state = STATE.ENDLESS;
  endlessRound = 0;
  round = Math.max(round + 1, 2);
  $('round-label').textContent = `ROUND ${round}`;
  balls = []; particles = []; powerUps = []; blasters = [];
  bossTimerActive = false;
  effects.slow = 0; effects.bigPaddle = 0; effects.extraBallTimer = 0;
  paddle.w = CFG.PADDLE_W_BASE;
  generateBlocks(round);
  spawnBall();
  playMusic('battle');
}

// ─── BOMB BROTHER INTRO ───────────────────────────────────────────
function beginBrotherDialogue() {
  bombX = -999; // hide original bomb
  const lines = [
    "...",
    "...",
    "YOU.",
    "You killed my brother.",
    "MY LITTLE BOMB.",
    "He warned me about you.",
    "Said there was something\ndifferent about this one.",
    "He was right to fear you.",
    "I am BOMBER.\nThey call me the elder.",
    "I have no brother anymore\nbecause of YOU.",
    "No mercy.\nNo sparring.\nOnly DESTRUCTION.",
    "Survive THIS if you dare.",
  ];
  startDialogue(lines, 'brother', '— BOMBER —', enterBrotherBoss);
}

function enterBrotherBoss() {
  state = STATE.BROTHER_BOSS;
  bossTimerActive = true;
  bossTimer = CFG.BROTHER_DURATION;
  bossMaxTimer = CFG.BROTHER_DURATION;
  blasterSpawnInterval = 1.8; // faster!
  blasterSpawnTimer = 0.5;
  blasters = [];
  brotherFightPhase = true;

  balls = balls.filter(b => !b.extra && b.active);
  if (balls.length === 0) spawnBall();
  balls.forEach(b => { b.held = true; b.holdTimer = 0; });

  $('boss-timer-wrap').style.display = 'flex';
  const m = Math.floor(CFG.BROTHER_DURATION / 60).toString().padStart(1,'0');
  const s = (CFG.BROTHER_DURATION % 60).toString().padStart(2,'0');
  $('boss-timer-text').textContent = `${m}:${s}`;
  $('boss-timer-fill').style.width = '100%';
  $('round-label').textContent = 'VENGEANCE';
  playMusic('boss');
}

function enterBrotherClimax() {
  state = STATE.BROTHER_CLIMAX;
  stopMusic();
  bossTimerActive = false;
  $('boss-timer-wrap').style.display = 'none';
  blasters = [];
  $('climax-msg').textContent = '— FINAL CHOICE —';
  $('climax-sub').textContent = 'The elder brother stands before you.';
  $('climax-overlay').style.display = 'flex';
}

function doBrotherSpare() {
  $('climax-overlay').style.display = 'none';
  alert('You spared the elder brother.\n\nHe stares at you in disbelief.\nThen turns and walks away.\n\nYou never see him again.');
  location.reload();
}

function doBrotherFight() {
  $('climax-overlay').style.display = 'none';
  brotherFightDone = true;

  // Epic finale - brother disappears, rose remains
  state = STATE.ROSE_SCENE;
  roseTimer = 0;
  roseX = CFG.W / 2; roseY = CFG.H / 2 - 40;
  roseParticles = [];

  // After rose scene, just resume endless
  const origEnter = enterEndless;
  const resumeEndless = () => {
    round++;
    $('round-label').textContent = `ROUND ${round}`;
    balls = []; particles = []; powerUps = []; blasters = [];
    bossTimerActive = false;
    effects.slow = 0; effects.bigPaddle = 0; effects.extraBallTimer = 0;
    paddle.w = CFG.PADDLE_W_BASE;
    generateBlocks(round);
    spawnBall();
    playMusic('battle');
    state = STATE.ENDLESS;
  };
  // Patch updateRoseScene's enterEndless call for this one-time
  window._roseOnDone = resumeEndless;
}

// ─── GAME OVER ────────────────────────────────────────────────────
function enterGameOver() {
  state = STATE.GAMEOVER;
  stopMusic();
  bossTimerActive = false;
  $('boss-timer-wrap').style.display = 'none';
  $('dialogue-overlay').style.display = 'none';
  $('climax-overlay').style.display = 'none';
  $('go-score-line').textContent = `SCORE: ${score}`;
  $('go-hi-line').textContent = `HI-SCORE: ${highScore}`;
  $('gameover-overlay').style.display = 'flex';
}

function hideOverlays() {
  $('dialogue-overlay').style.display = 'none';
  $('climax-overlay').style.display = 'none';
  $('gameover-overlay').style.display = 'none';
  $('boss-timer-wrap').style.display = 'none';
  $('pu-status').innerHTML = '';
}

// ──────────────────────────────────────────────────────────────────
//  DRAW BOMB CHARACTER ON MAIN CANVAS (during transition/boss)
// ──────────────────────────────────────────────────────────────────
function drawMainCharacter(t) {
  const float = Math.sin(t * 1.8) * 8;
  const quake = (state === STATE.BOSS || state === STATE.BROTHER_BOSS) ?
    Math.sin(t * 14) * (bossTimer < 20 ? 3 : 1) : 0;

  if (state === STATE.TRANSITION || state === STATE.BOSS || state === STATE.CLIMAX) {
    // Draw bomb
    drawBombOnCanvas(ctx, bombX + quake, bombY + float, 55, state !== STATE.TRANSITION, t);
  }
  if (state === STATE.BROTHER_INTRO || state === STATE.BROTHER_BOSS || state === STATE.BROTHER_CLIMAX) {
    drawBombBrotherOnCanvas(ctx, CFG.W / 2 + quake, 190 + float, 62, t);
  }
}

// ──────────────────────────────────────────────────────────────────
//  UPDATE LOOP
// ──────────────────────────────────────────────────────────────────
function updatePlaying(dt) {
  // Paddle movement (keyboard)
  if (platform === 'pc') {
    const spd = 350 * dt;
    if (keys.left)  paddle.x -= spd;
    if (keys.right) paddle.x += spd;
  }
  // Clamp paddle
  paddle.x = Math.max(paddle.w / 2, Math.min(CFG.W - paddle.w / 2, paddle.x));

  // Move balls
  for (const b of balls) {
    if (!b.active) continue;
    moveBall(b, dt);
    // Speed scaling for effects
    if (!b.held) {
      const target = (effects.slow > 0 ? CFG.BALL_SPEED_BASE * 0.55 : CFG.BALL_SPEED_BASE);
      const cur = ballSpeed(b);
      if (cur > 0 && cur < target * 0.8) setBallSpeed(b, target);
    }
  }
  // Remove dead balls
  balls = balls.filter(b => b.active || !b.extra); // keep primary ball reference
  balls = balls.filter(b => b.active);
  if (!balls.some(b => !b.extra)) spawnBall(); // ensure primary exists

  // Power-ups fall
  for (const pu of powerUps) {
    if (!pu.active) continue;
    pu.y += pu.vy;
    pu.x += pu.vx;
    // Collect
    const px = paddle.x, py = paddle.y, pw = paddle.w;
    if (pu.y + 10 >= py && pu.y - 10 <= py + CFG.PADDLE_H &&
        pu.x + 14 >= px - pw/2 && pu.x - 14 <= px + pw/2) {
      pu.active = false;
      applyPowerUp(pu);
    }
    // Off-screen
    if (pu.y > CFG.H) pu.active = false;
  }
  powerUps = powerUps.filter(p => p.active);

  // Effects timers
  if (effects.slow > 0) {
    effects.slow -= dt;
    if (effects.slow <= 0) {
      effects.slow = 0;
      balls.forEach(b => { if (!b.held) setBallSpeed(b, CFG.BALL_SPEED_BASE); });
    }
  }
  if (effects.bigPaddle > 0) {
    effects.bigPaddle -= dt;
    if (effects.bigPaddle <= 0) { effects.bigPaddle = 0; paddle.w = CFG.PADDLE_W_BASE; }
  }
  if (effects.extraBallTimer > 0) {
    effects.extraBallTimer -= dt;
    if (effects.extraBallTimer <= 0) {
      effects.extraBallTimer = 0;
      // Remove extra ball
      const extraIdx = balls.findIndex(b => b.extra);
      if (extraIdx !== -1) balls.splice(extraIdx, 1);
    }
  }
  if (Math.random() < dt * 0.5) updatePUBadges(); // throttle badge update

  // Particles
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.12;
    p.life -= dt * 1.5;
  }
  particles = particles.filter(p => p.life > 0);

  // Block flash timers
  for (const bl of blocks) {
    if (bl.flashTimer > 0) bl.flashTimer -= dt;
  }

  // Shake
  if (shakeAmt > 0) {
    shakeX = (Math.random() - 0.5) * shakeAmt;
    shakeY = (Math.random() - 0.5) * shakeAmt;
    shakeAmt *= 0.82;
    if (shakeAmt < 0.4) shakeAmt = 0;
  } else { shakeX = 0; shakeY = 0; }

  // Flash
  if (flashAlpha > 0) flashAlpha -= dt * 2;

  // Check blocks cleared
  if ((state === STATE.PLAYING || state === STATE.ENDLESS) && blocksRemaining() === 0) {
    onAllBlocksCleared();
  }
}

function updateBossPhase(dt) {
  // Paddle + ball still active
  updatePlaying(dt);

  if (bossTimerActive && state !== STATE.GAMEOVER) {
    bossTimer -= dt;
    if (bossTimer <= 0) {
      bossTimer = 0;
      bossTimerActive = false;
      if (state === STATE.BOSS) enterClimax();
      else if (state === STATE.BROTHER_BOSS) enterBrotherClimax();
    }

    // Timer display
    const m = Math.floor(bossTimer / 60);
    const s = Math.floor(bossTimer % 60).toString().padStart(2, '0');
    $('boss-timer-text').textContent = `${m}:${s}`;
    const pct = (bossTimer / bossMaxTimer) * 100;
    $('boss-timer-fill').style.width = pct + '%';

    // Color warning
    const timerEl = $('boss-timer-text');
    if (bossTimer < 20) {
      timerEl.style.animation = 'blink 0.4s step-end infinite';
    } else {
      timerEl.style.animation = 'none';
    }

    // Spawn blasters
    blasterSpawnTimer -= dt;
    if (blasterSpawnTimer <= 0) {
      const count = brotherFightPhase ? (bossTimer < 40 ? 3 : 2) : (bossTimer < 40 ? 2 : 1);
      spawnBlaster(count);
      blasterSpawnTimer = blasterSpawnInterval * (brotherFightPhase ? 0.75 : 1);
      if (brotherFightPhase && bossTimer < 30) blasterSpawnTimer *= 0.6;
    }

    updateBlasters(dt);
  }
}

// ──────────────────────────────────────────────────────────────────
//  DRAW LOOP
// ──────────────────────────────────────────────────────────────────
function draw(t) {
  ctx.save();
  if (shakeAmt > 0) ctx.translate(shakeX, shakeY);

  drawBackground();
  drawFlash();

  if (state === STATE.PLAYING || state === STATE.ENDLESS) {
    drawBlocks();
    drawPowerUps();
    drawParticles();
    balls.forEach(drawBall);
    drawPaddle();

  } else if (state === STATE.BOSS || state === STATE.BROTHER_BOSS) {
    drawBlasters(t);
    drawParticles();
    balls.forEach(drawBall);
    drawPaddle();
    drawMainCharacter(t);

  } else if (state === STATE.TRANSITION || state === STATE.CLIMAX) {
    // Show character floating
    drawMainCharacter(t);
    // Cinematic letterbox
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, CFG.W, 80);
    ctx.fillRect(0, CFG.H - 60, CFG.W, 60);

  } else if (state === STATE.BROTHER_INTRO || state === STATE.BROTHER_CLIMAX) {
    drawMainCharacter(t);
    // Dark letterbox
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CFG.W, 80);

    // "REVENGE" text during brother intro
    if (state === STATE.BROTHER_INTRO) {
      ctx.save();
      glow('#ff2200', 30);
      ctx.fillStyle = 'rgba(255,30,0,0.08)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      clearGlow();
      ctx.restore();
    }

  } else if (state === STATE.ROSE_SCENE) {
    drawRoseScene(t);
  }

  ctx.restore();
}

// Portrait animation in dialogue
let portraitT = 0;

// ──────────────────────────────────────────────────────────────────
//  MAIN LOOP
// ──────────────────────────────────────────────────────────────────
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  const t = timestamp / 1000;

  // Update portrait animation
  if (dlg.active) {
    portraitT += dt;
    drawPortrait(dlg.portrait, portraitT);
  }

  // Dialogue update
  updateDialogue(dt);

  // State update
  switch (state) {
    case STATE.PLAYING:
    case STATE.ENDLESS:
      updatePlaying(dt);
      draw(t);
      break;

    case STATE.BOSS:
    case STATE.BROTHER_BOSS:
      updateBossPhase(dt);
      draw(t);
      break;

    case STATE.TRANSITION:
    case STATE.BROTHER_INTRO:
    case STATE.CLIMAX:
    case STATE.BROTHER_CLIMAX:
      // Minimal update — just shake + flash decay
      if (shakeAmt > 0) { shakeX = (Math.random()-0.5)*shakeAmt; shakeY=(Math.random()-0.5)*shakeAmt; shakeAmt*=0.82; if(shakeAmt<0.4)shakeAmt=0; }
      if (flashAlpha > 0) flashAlpha -= dt * 2;
      draw(t);
      break;

    case STATE.ROSE_SCENE:
      updateRoseScene(dt);
      draw(t);
      break;
  }

  rafId = requestAnimationFrame(loop);
}

// ──────────────────────────────────────────────────────────────────
//  ROSE SCENE END — check for brother variant
// ──────────────────────────────────────────────────────────────────
const _origUpdateRoseScene = updateRoseScene;
function updateRoseScene(dt) {
  roseTimer += dt;
  if (roseTimer < 1.5) {
    roseY = CFG.H / 2 - 40 - Math.max(0, (1 - roseTimer / 1.5) * 100);
  }
  if (roseTimer > 2.5) {
    if (roseParticles.length < 40) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        roseParticles.push({
          x: roseX, y: roseY, vx: Math.cos(a) * (2+Math.random()*5),
          vy: Math.sin(a) * (2+Math.random()*5) - 2,
          life: 1, maxLife: 1, color: '#ff4466', size: 4+Math.random()*7,
        });
      }
    }
    for (const rp of roseParticles) {
      rp.x += rp.vx * dt * 60; rp.y += rp.vy * dt * 60;
      rp.vy += 0.1 * dt * 60;
      rp.life -= dt * 1.5;
    }
  }
  if (roseTimer > 4.2) {
    if (window._roseOnDone) {
      const fn = window._roseOnDone;
      window._roseOnDone = null;
      fn();
    } else {
      enterEndless();
    }
  }
}

function drawRoseScene(t) {
  drawBackground();
  if (roseTimer > 0.5 && roseTimer < 2.8) {
    const alpha = Math.min(1, (roseTimer - 0.5) * 1.5) * (roseTimer > 2.3 ? Math.max(0, (2.8 - roseTimer) * 2) : 1);
    ctx.globalAlpha = alpha;
    glow('#ff4466', 20);
    ctx.fillStyle = '#ff4466';
    ctx.font = `13px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU CHOSE TO FIGHT', CFG.W / 2, CFG.H / 2 + 90);
    clearGlow();
    ctx.globalAlpha = 1;
  }
  const alpha2 = roseTimer < 0.5 ? roseTimer * 2 :
    roseTimer > 3.6 ? Math.max(0, 1-(roseTimer-3.6)*2) : 1;
  drawRose(roseX, roseY, 28, t, alpha2);
  for (const rp of roseParticles) {
    const a = Math.max(0, rp.life);
    ctx.globalAlpha = a;
    glow('#ff4466', 8);
    ctx.fillStyle = '#ff4466';
    ctx.fillRect(rp.x-rp.size/2, rp.y-rp.size/2, rp.size, rp.size);
    clearGlow();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ──────────────────────────────────────────────────────────────────
//  UI WIRING
// ──────────────────────────────────────────────────────────────────
function init() {
  // Initialize canvas references
  initCanvasRefs();

  // Setup screen fitting
  window.addEventListener('resize', fitScreen);
  fitScreen();

  // Menu buttons
  $('btn-pc').addEventListener('click', () => {
    if (menuAudioQueued) { playMusic('menu'); menuAudioQueued = false; }
    startGame('pc');
  });
  $('btn-mobile').addEventListener('click', () => {
    if (menuAudioQueued) { playMusic('menu'); menuAudioQueued = false; }
    startGame('mobile');
  });

  // Volume sliders
  $('music-vol').addEventListener('input', function() {
    musicVol = parseFloat(this.value);
    $('music-pct').textContent = Math.round(musicVol * 100) + '%';
    syncMusicVol();
  });
  $('sfx-vol').addEventListener('input', function() {
    sfxVol = parseFloat(this.value);
    $('sfx-pct').textContent = Math.round(sfxVol * 100) + '%';
  });

  // Climax buttons
  $('btn-fight').addEventListener('click', () => {
    if (state === STATE.CLIMAX) doFight();
    else if (state === STATE.BROTHER_CLIMAX) doBrotherFight();
  });
  $('btn-spare').addEventListener('click', () => {
    if (state === STATE.CLIMAX) doSpare();
    else if (state === STATE.BROTHER_CLIMAX) doBrotherSpare();
  });

  // Restart
  $('btn-restart').addEventListener('click', () => location.reload());

  // High score display
  $('menu-hi-val').textContent = highScore;
  $('hi-val').textContent = highScore;

  // Autoplay menu music
  SND.menu.volume = musicVol;
  SND.menu.play().catch(() => { menuAudioQueued = true; });

  // Start game loop
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);

  // Start on menu
  state = STATE.MENU;
}

// ──────────────────────────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);