const W = 480;
const H = 640;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (a, b) => Math.random() * (b - a) + a;
const rint = (a, b) => Math.floor(rand(a, b + 1));
const now = () => performance.now();

const AudioSys = {
  unlocked: false,
  musicVol: 0.5,
  sfxVol: 0.5,
  menuMusic: new Audio('menu.ogg'),
  battleStart: new Audio('battle-start.mp3'),
  battleMusic: new Audio('battle.ogg'),
  bossMusic: new Audio('Megalovania.mp3'),
  talkSfx: new Audio('just-sans-talking.mp3'),
  blasterSfx: new Audio('gaster_blaster.mp3'),
  loseSfx: new Audio('lose.ogg'),

  init() {
    this.menuMusic.loop = true;
    this.battleMusic.loop = true;
    this.bossMusic.loop = true;
    this.updateVolumes();
  },

  updateVolumes() {
    const mv = document.getElementById('vol-music');
    const sv = document.getElementById('vol-sfx');
    if (mv) this.musicVol = Number(mv.value);
    if (sv) this.sfxVol = Number(sv.value);

    this.menuMusic.volume = this.musicVol;
    this.battleMusic.volume = this.musicVol;
    this.bossMusic.volume = this.musicVol;
    this.battleStart.volume = this.musicVol * 0.9;

    this.talkSfx.volume = this.sfxVol;
    this.blasterSfx.volume = this.sfxVol;
    this.loseSfx.volume = this.sfxVol;
  },

  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      this.menuMusic.currentTime = 0;
      await this.menuMusic.play();
    } catch (_) {}
  },

  playMenu() {
    this.stopMusic();
    this.menuMusic.currentTime = 0;
    this.menuMusic.play().catch(() => {});
  },

  playBattleStartThenLoop() {
    this.stopMusic();
    this.battleStart.currentTime = 0;
    this.battleStart.play().catch(() => {});
    this.battleStart.onended = () => {
      this.battleMusic.currentTime = 0;
      this.battleMusic.play().catch(() => {});
    };
  },

  playBossMusic() {
    this.stopMusic();
    this.bossMusic.currentTime = 0;
    this.bossMusic.play().catch(() => {});
  },

  stopMusic() {
    [this.menuMusic, this.battleMusic, this.bossMusic, this.battleStart].forEach(a => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (_) {}
    });
  },

  playSfx(audio) {
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (_) {}
  }
};

const Game = {
  canvas: null,
  ctx: null,

  state: 'BOOT',
  mode: 'pc',
  phase: 'menu',
  score: 0,
  hiscore: Number(localStorage.getItem('determination_hiscore') || 0),
  hp: 100,
  maxHp: 100,
  round: 1,
  wave: 1,

  paddle: {
    x: W / 2 - 55,
    y: H - 38,
    w: 110,
    h: 14,
    baseW: 110,
    targetX: W / 2 - 55,
    vx: 0,
    speed: 340
  },

  balls: [],
  bricks: [],
  items: [],
  blasters: [],
  particles: [],
  flowers: [],
  followers: [],
  effects: {
    slowUntil: 0,
    growUntil: 0
  },

  keys: { left: false, right: false },
  mouseX: W / 2,
  mobileTouchActive: false,
  mobileTouchX: null,

  bossTimer: 120000,
  bossTimerStart: 0,
  bossNextBlasterAt: 0,
  bossLineHoldUntil: 0,
  bossTransitioning: false,
  climaxChoiceShown: false,
  endlessMode: false,
  reclaimAnimating: false,
  releaseAnimating: false,
  dialogueRunning: false,
  dialogueBusy: false,
  dialogueText: '',
  dialogueIndex: 0,
  dialogueCharTimer: 0,
  dialogueLine: '',

  lastFrameTime: 0,
  shake: 0,
  gameOverTimer: 0,

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.setHiScore(this.hiscore);
    AudioSys.init();
    this.bindUI();
    this.bindInput();
    this.drawBootFrame();
    AudioSys.playMenu();
    requestAnimationFrame(this.loop.bind(this));
  },

  bindUI() {
    document.getElementById('boot-screen').addEventListener('click', async () => {
      await AudioSys.unlock();
      this.showMenu();
    });

    document.getElementById('btn-pc').addEventListener('click', async () => {
      await AudioSys.unlock();
      this.startGame('pc');
    });

    document.getElementById('btn-mobile').addEventListener('click', async () => {
      await AudioSys.unlock();
      this.startGame('mobile');
    });

    document.getElementById('btn-reclaim').addEventListener('click', () => {
      if (!this.climaxChoiceShown) return;
      this.startReclaimSequence();
    });

    document.getElementById('btn-release').addEventListener('click', () => {
      if (!this.climaxChoiceShown) return;
      this.startReleaseSequence();
    });

    document.getElementById('vol-music').addEventListener('input', () => AudioSys.updateVolumes());
    document.getElementById('vol-sfx').addEventListener('input', () => AudioSys.updateVolumes());
  },

  bindInput() {
    window.addEventListener('pointerdown', () => AudioSys.unlock(), { once: true });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.keys.left = true;
      if (e.key === 'ArrowRight') this.keys.right = true;

      if (e.key === ' ' || e.key === 'Enter') {
        if (this.phase === 'boss' && this.balls.length) {
          // no-op; keeps keyboard feel alive
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') this.keys.left = false;
      if (e.key === 'ArrowRight') this.keys.right = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      this.mouseX = x;
      if (this.mode === 'pc' && (this.phase === 'breakout' || this.phase === 'endless' || this.phase === 'boss')) {
        this.paddle.targetX = x - this.paddle.w / 2;
      }
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (this.mode !== 'mobile') return;
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = (t.clientX - rect.left) * (W / rect.width);
      const y = (t.clientY - rect.top) * (H / rect.height);
      if (y > H - 104) {
        this.mobileTouchActive = true;
        this.mobileTouchX = x;
        this.paddle.targetX = x - this.paddle.w / 2;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.mode !== 'mobile' || !this.mobileTouchActive) return;
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = (t.clientX - rect.left) * (W / rect.width);
      this.mobileTouchX = x;
      this.paddle.targetX = x - this.paddle.w / 2;
    }, { passive: false });

    window.addEventListener('touchend', () => {
      this.mobileTouchActive = false;
      this.mobileTouchX = null;
    });
  },

  showMenu() {
    this.state = 'menu';
    this.phase = 'menu';
    this.endlessMode = false;
    this.climaxChoiceShown = false;
    this.dialogueRunning = false;
    this.dialogueBusy = false;
    this.resetVisuals();
    this.hideAllScreens();
    document.getElementById('menu-screen').classList.add('active');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
    document.getElementById('dialogue-box').classList.add('hidden');
    document.getElementById('choice-screen').classList.add('hidden');
    document.getElementById('ui-hiscore-menu').innerText = String(this.hiscore);
    AudioSys.playMenu();
    this.drawMenuFrame();
  },

  startGame(mode) {
    this.mode = mode;
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('boot-screen').classList.remove('active');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('mobile-controls').classList.toggle('hidden', mode !== 'mobile');
    document.getElementById('choice-screen').classList.add('hidden');
    document.getElementById('dialogue-box').classList.add('hidden');

    this.score = 0;
    this.hp = this.maxHp;
    this.wave = 1;
    this.round = 1;
    this.effects.slowUntil = 0;
    this.effects.growUntil = 0;
    this.climaxChoiceShown = false;
    this.bossTransitioning = false;
    this.endlessMode = false;
    this.reclaimAnimating = false;
    this.releaseAnimating = false;
    this.dialogueRunning = false;
    this.dialogueBusy = false;
    this.clearWorld();

    this.paddle.w = this.paddle.baseW;
    this.paddle.x = W / 2 - this.paddle.w / 2;
    this.paddle.targetX = this.paddle.x;

    this.createBreakoutWave(this.wave);
    this.phase = 'breakout';
    this.state = 'playing';
    this.updateHUD();
    AudioSys.playBattleStartThenLoop();
    this.flashText('ROUND 1');
  },

  clearWorld() {
    this.balls = [];
    this.bricks = [];
    this.items = [];
    this.blasters = [];
    this.particles = [];
    this.flowers = [];
    this.followers = [];
  },

  resetVisuals() {
    this.clearWorld();
    this.shake = 0;
  },

  hideAllScreens() {
    ['menu-screen', 'boot-screen', 'choice-screen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
  },

  updateHUD() {
    const hpText = document.getElementById('ui-hp');
    const hpBar = document.getElementById('hp-bar-fill');
    const scoreText = document.getElementById('ui-score');
    const hiscoreText = document.getElementById('ui-hiscore');
    const hiscoreMenu = document.getElementById('ui-hiscore-menu');
    const timerText = document.getElementById('ui-timer');

    if (hpText) hpText.innerText = `${Math.ceil(this.hp)}/${this.maxHp}`;
    if (hpBar) hpBar.style.width = `${clamp(this.hp / this.maxHp, 0, 1) * 100}%`;
    if (scoreText) scoreText.innerText = String(this.score);
    if (hiscoreText) hiscoreText.innerText = String(this.hiscore);
    if (hiscoreMenu) hiscoreMenu.innerText = String(this.hiscore);

    if (timerText) {
      if (this.phase === 'boss' || this.climaxChoiceShown) timerText.classList.remove('hidden');
      else timerText.classList.add('hidden');

      const t = Math.max(0, this.bossTimer);
      const s = Math.ceil(t / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      timerText.innerText = `${mm}:${ss}`;
    }
  },

  setHiScore(value) {
    this.hiscore = value;
    localStorage.setItem('determination_hiscore', String(this.hiscore));
    this.updateHUD();
  },

  updateHiScore() {
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      localStorage.setItem('determination_hiscore', String(this.hiscore));
    }
  },

  flashText(text) {
    this.particles.push({
      type: 'text',
      x: W / 2,
      y: H / 2 - 60,
      text,
      life: 1200,
      maxLife: 1200
    });
  },

  createBreakoutWave(waveNumber) {
    this.bricks = [];
    this.items = [];
    this.balls = [];

    const cols = 10;
    const rows = clamp(5 + Math.floor((waveNumber - 1) * 0.6), 5, 10);
    const brickW = 40;
    const brickH = 18;
    const gap = 2;
    const totalW = cols * brickW + (cols - 1) * gap;
    const startX = (W - totalW) / 2;
    const startY = 84;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.bricks.push({
          x: startX + c * (brickW + gap),
          y: startY + r * (brickH + gap),
          w: brickW,
          h: brickH,
          row: r,
          hp: 1,
          alive: true
        });
      }
    }

    const ballSpeed = 230 + (waveNumber - 1) * 18;
    this.balls.push(this.makeBall(W / 2, H - 80, rand(-0.7, 0.7), -1, ballSpeed));
  },

  makeBall(x, y, dxNorm, dyNorm, speed) {
    const len = Math.hypot(dxNorm, dyNorm) || 1;
    const dx = dxNorm / len;
    const dy = dyNorm / len;
    return {
      x,
      y,
      r: 5,
      vx: dx * speed,
      vy: dy * speed,
      alive: true,
      trail: []
    };
  },

  duplicateBall(ball) {
    const angle = Math.atan2(ball.vy, ball.vx) + rand(-0.7, 0.7);
    const speed = Math.hypot(ball.vx, ball.vy);
    return {
      x: ball.x,
      y: ball.y,
      r: ball.r,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alive: true,
      trail: []
    };
  },

  startBossTransition() {
    if (this.bossTransitioning) return;
    this.bossTransitioning = true;
    this.phase = 'transition';
    AudioSys.stopMusic();
    this.dialogueRunning = true;
    this.typeDialogue(
      'BOSS',
      '☠️',
      'SO... YOU MADE IT THIS FAR.\nTHE REAL TRIAL BEGINS NOW.',
      () => {
        setTimeout(() => {
          this.startBossFight();
        }, 900);
      }
    );
  },

  typeDialogue(speaker, portrait, text, done) {
    this.dialogueBusy = true;
    const box = document.getElementById('dialogue-box');
    const speakerName = document.getElementById('speaker-name');
    const portraitEl = document.getElementById('portrait');
    const dialogueText = document.getElementById('dialogue-text');

    speakerName.innerText = speaker;
    portraitEl.innerText = portrait;
    dialogueText.innerText = '';
    box.classList.remove('hidden');

    this.dialogueText = text;
    this.dialogueIndex = 0;

    const step = () => {
      if (this.dialogueIndex >= this.dialogueText.length) {
        this.dialogueBusy = false;
        if (done) done();
        return;
      }

      const ch = this.dialogueText[this.dialogueIndex++];
      dialogueText.innerText += ch;

      if (ch !== ' ' && ch !== '\n') {
        AudioSys.playSfx(AudioSys.talkSfx);
      }

      const delay = ch === '\n' ? 90 : ch === '.' || ch === '!' || ch === '?' ? 110 : 25;
      setTimeout(step, delay);
    };

    step();
  },

  startBossFight() {
    this.dialogueRunning = false;
    document.getElementById('dialogue-box').classList.add('hidden');
    this.phase = 'boss';
    this.bossTransitioning = false;
    this.bossTimer = 120000;
    this.bossTimerStart = now();
    this.bossNextBlasterAt = now() + 1300;
    this.blasters = [];
    this.items = [];
    this.flowers = [];
    this.followers = [];
    this.particles.push({ type: 'boss-arrive', x: W / 2, y: 120, life: 1800, maxLife: 1800 });
    AudioSys.playBossMusic();
    this.showBossIntro();
    this.updateHUD();
  },

  showBossIntro() {
    const box = document.getElementById('dialogue-box');
    const speakerName = document.getElementById('speaker-name');
    const portraitEl = document.getElementById('portrait');
    const dialogueText = document.getElementById('dialogue-text');

    speakerName.innerText = 'BOSS';
    portraitEl.innerText = '☠️';
    dialogueText.innerText = 'THIS IS THE BOSS PHASE.\nDODGE THE BLASTERS.';
    box.classList.remove('hidden');

    setTimeout(() => {
      box.classList.add('hidden');
    }, 1800);
  },

  startClimaxChoice() {
    if (this.climaxChoiceShown) return;
    this.phase = 'choice';
    this.climaxChoiceShown = true;
    AudioSys.stopMusic();
    document.getElementById('choice-screen').classList.add('active');
    this.updateHUD();
  },

  startReclaimSequence() {
    this.climaxChoiceShown = false;
    document.getElementById('choice-screen').classList.remove('active');
    document.getElementById('dialogue-box').classList.add('hidden');
    this.phase = 'reclaim';
    this.reclaimAnimating = true;
    this.particles.push({ type: 'burst', x: W / 2, y: 120, life: 2000, maxLife: 2000 });
    this.flashText('RECLAIM');
    this.followers.push({
      x: -40,
      y: H - 120,
      vx: 48,
      life: 3200,
      maxLife: 3200,
      phase: 'enter'
    });

    this.particles.push({
      type: 'boss-burst',
      x: W / 2,
      y: 128,
      life: 900,
      maxLife: 900
    });

    setTimeout(() => {
      this.flowers.push({ x: W / 2 - 5, y: H - 96, life: 2600, maxLife: 2600 });
    }, 1400);

    setTimeout(() => {
      this.startEndlessMode();
    }, 3600);
  },

  startReleaseSequence() {
    this.climaxChoiceShown = false;
    document.getElementById('choice-screen').classList.remove('active');
    document.getElementById('dialogue-box').classList.add('hidden');
    this.phase = 'release';
    this.releaseAnimating = true;
    this.flashText('RELEASE');
    setTimeout(() => {
      this.showMenu();
    }, 2500);
  },

  startEndlessMode() {
    this.endlessMode = true;
    this.phase = 'endless';
    this.wave = 1;
    this.score += 500;
    this.updateHiScore();
    this.createBreakoutWave(this.wave);
    this.items = [];
    this.blasters = [];
    this.bossTimer = 0;
    AudioSys.playBattleStartThenLoop();
    this.flashText('ENDLESS MODE');
    this.updateHUD();
  },

  addParticles(x, y, color, count = 8, speed = 120) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.4, speed);
      this.particles.push({
        type: 'pixel',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        life: rand(350, 900),
        maxLife: 900
      });
    }
  },

  spawnItem(x, y) {
    const roll = Math.random();
    let type = 'slow';
    if (roll < 0.25) type = 'slow';
    else if (roll < 0.5) type = 'grow';
    else if (roll < 0.75) type = 'star';
    else type = 'bomb';

    this.items.push({
      x, y, w: 14, h: 14,
      vy: 95,
      type
    });
  },

  applyItem(type) {
    const t = now();
    if (type === 'slow') {
      this.effects.slowUntil = t + 5000;
      this.flashText('SLOW');
    } else if (type === 'grow') {
      this.effects.growUntil = t + 5000;
      this.flashText('BIG PADDLE');
    } else if (type === 'star') {
      if (this.balls.length) {
        this.balls.push(this.duplicateBall(this.balls[0]));
      }
      this.flashText('EXTRA BALL');
    } else if (type === 'bomb') {
      this.damage(15);
      this.flashText('-15 HP');
    }
  },

  damage(amount) {
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;
    this.shake = 10;
    this.updateHUD();
    if (this.hp <= 0) {
      this.gameOver();
    }
  },

  gameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.phase = 'gameover';
    AudioSys.stopMusic();
    AudioSys.playSfx(AudioSys.loseSfx);
    this.updateHiScore();
    this.updateHUD();
    this.flashText(`FINAL SCORE ${this.score}`);

    this.gameOverTimer = now() + 2600;
    setTimeout(() => {
      this.showMenu();
    }, 2600);
  },

  update(dt, t) {
    const slow = t < this.effects.slowUntil ? 0.68 : 1;
    const grow = t < this.effects.growUntil ? 1.6 : 1;

    this.paddle.w = this.paddle.baseW * grow;
    this.paddle.targetX = clamp(this.paddle.targetX, 0, W - this.paddle.w);

    if (this.mode === 'pc' && (this.phase === 'breakout' || this.phase === 'endless' || this.phase === 'boss')) {
      if (this.keys.left) this.paddle.targetX -= this.paddle.speed * dt;
      if (this.keys.right) this.paddle.targetX += this.paddle.speed * dt;
    }

    this.paddle.targetX = clamp(this.paddle.targetX, 0, W - this.paddle.w);
    this.paddle.x += (this.paddle.targetX - this.paddle.x) * Math.min(1, dt * 12);

    if (this.phase === 'breakout' || this.phase === 'endless') {
      this.updateBalls(dt, t, slow, false);
      this.updateBricks(dt);
      this.updateItems(dt);
      this.updateEndlessOrRoundClear();
    } else if (this.phase === 'boss') {
      this.updateBossPhase(dt, t, slow);
    } else if (this.phase === 'reclaim') {
      this.updateBalls(dt, t, slow, true);
      this.updateReclaim(dt);
    } else if (this.phase === 'release') {
      this.updateRelease(dt);
    }

    this.updateParticles(dt);

    if (this.hp <= 0 && this.state !== 'gameover' && this.phase !== 'menu') {
      this.gameOver();
    }

    this.updateHUD();
  },

  updateBalls(dt, t, slowFactor, ignoreOutOfBoundsLoss) {
    const gravityKick = 0;
    const paddleTop = this.paddle.y;

    for (const ball of this.balls) {
      if (!ball.alive) continue;

      ball.trail.push({ x: ball.x, y: ball.y, life: 160 });
      if (ball.trail.length > 10) ball.trail.shift();

      ball.x += ball.vx * dt * slowFactor;
      ball.y += ball.vy * dt * slowFactor;

      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      }

      if (ball.x + ball.r > W) {
        ball.x = W - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }

      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      if (ball.y - ball.r > H) {
        ball.alive = false;
        if (!ignoreOutOfBoundsLoss) {
          this.damage(this.phase === 'boss' ? 20 : 10);
        }
      }

      if (this.intersectCircleRect(ball, this.paddle)) {
        ball.y = this.paddle.y - ball.r - 0.5;
        const hit = ((ball.x - this.paddle.x) / this.paddle.w) * 2 - 1;
        const speed = Math.max(240, Math.hypot(ball.vx, ball.vy));
        const angle = -Math.PI / 2 + hit * 0.9;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        AudioSys.playSfx(AudioSys.talkSfx);
      }

      if (this.phase === 'breakout' || this.phase === 'endless') {
        for (const brick of this.bricks) {
          if (!brick.alive) continue;
          if (this.intersectCircleRect(ball, brick)) {
            brick.alive = false;
            this.score += 10 + brick.row * 2;
            this.updateHiScore();
            this.addParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, '#ffffff', 10, 160);
            AudioSys.playSfx(AudioSys.talkSfx);

            if (Math.random() < 0.20) {
              this.spawnItem(brick.x + brick.w / 2 - 7, brick.y + brick.h / 2 - 7);
            }

            const overlapLeft = ball.x - ball.r - brick.x;
            const overlapRight = brick.x + brick.w - (ball.x + ball.r);
            const overlapTop = ball.y - ball.r - brick.y;
            const overlapBottom = brick.y + brick.h - (ball.y + ball.r);
            const minOverlap = Math.min(Math.abs(overlapLeft), Math.abs(overlapRight), Math.abs(overlapTop), Math.abs(overlapBottom));

            if (minOverlap === Math.abs(overlapLeft) || minOverlap === Math.abs(overlapRight)) {
              ball.vx *= -1;
            } else {
              ball.vy *= -1;
            }

            break;
          }
        }
      }
    }

    this.balls = this.balls.filter(b => b.alive);

    if (!this.balls.length && (this.phase === 'breakout' || this.phase === 'endless')) {
      this.damage(20);
      this.balls.push(this.makeBall(
        this.paddle.x + this.paddle.w / 2,
        this.paddle.y - 18,
        rand(-0.65, 0.65),
        -1,
        this.phase === 'endless' ? 260 + this.wave * 18 : 230
      ));
    }

    if (this.phase === 'boss') {
      this.balls = this.balls.filter(b => b.alive);
      if (!this.balls.length) {
        this.damage(20);
        this.balls.push(this.makeBall(this.paddle.x + this.paddle.w / 2, this.paddle.y - 18, rand(-0.65, 0.65), -1, 255));
      }
    }
  },

  updateBricks(dt) {
    this.bricks = this.bricks.filter(b => b.alive);
  },

  updateItems(dt) {
    for (const item of this.items) {
      item.y += item.vy * dt;
      if (this.intersectRect(item, this.paddle)) {
        item.collected = true;
        this.applyItem(item.type);
      }
    }
    this.items = this.items.filter(item => !item.collected && item.y < H + 20);
  },

  updateEndlessOrRoundClear() {
    if (this.phase !== 'breakout' && this.phase !== 'endless') return;

    if (this.bricks.length === 0) {
      if (this.phase === 'breakout') {
        this.startBossTransition();
      } else if (this.phase === 'endless') {
        this.wave++;
        this.score += 250;
        this.updateHiScore();
        this.flashText(`WAVE ${this.wave}`);
        this.createBreakoutWave(this.wave);
      }
    }
  },

  updateBossPhase(dt, t, slowFactor) {
    this.bossTimer -= dt * 1000;
    if (this.bossTimer <= 0) {
      this.bossTimer = 0;
      this.startClimaxChoice();
      return;
    }

    if (t >= this.bossNextBlasterAt && this.blasters.length < 4) {
      this.spawnBlaster();
      this.bossNextBlasterAt = t + rand(850, 1500);
    }

    for (const b of this.blasters) {
      if (b.phase === 'telegraph') {
        b.timer -= dt * 1000;
        if (b.timer <= 0) {
          b.phase = 'fire';
          b.timer = b.fireMs;
          AudioSys.playSfx(AudioSys.blasterSfx);
          this.addParticles(b.x, b.y, '#ff00ff', 12, 180);
        }
      } else if (b.phase === 'fire') {
        b.timer -= dt * 1000;
        if (b.timer <= 0) {
          b.dead = true;
        }
      }
    }

    this.blasters = this.blasters.filter(b => !b.dead);

    for (const b of this.blasters) {
      if (b.phase === 'fire') {
        const beamRect = { x: b.x - b.beamW / 2, y: 0, w: b.beamW, h: H };
        for (const ball of this.balls) {
          if (this.intersectCircleRect(ball, beamRect)) {
            ball.vx *= 0.96;
            ball.vy *= 0.96;
          }
        }

        if (this.intersectRect(this.paddle, beamRect)) {
          this.damage(14 * dt * 6);
        }
      }
    }

    this.updateBalls(dt, t, slowFactor, false);

    if (this.hp <= 0) return;
  },

  spawnBlaster() {
    const x = rint(52, W - 52);
    this.blasters.push({
      x,
      y: 74,
      beamW: 22,
      telegraphW: 2,
      telegraphMs: 1000,
      fireMs: 850,
      phase: 'telegraph',
      timer: 1000,
      dead: false
    });

    this.particles.push({
      type: 'warning',
      x,
      y: 0,
      life: 1000,
      maxLife: 1000
    });
  },

  updateReclaim(dt) {
    for (const f of this.followers) {
      f.x += f.vx * dt;
      f.life -= dt * 1000;
      if (f.x > W / 2 - 6 && !f.spawnedFlower) {
        this.flowers.push({ x: f.x, y: H - 96, life: 2200, maxLife: 2200 });
        f.spawnedFlower = true;
      }
    }
    this.followers = this.followers.filter(f => f.life > 0);
    this.flowers = this.flowers.filter(f => f.life > 0);
    if (this.bossTimer > 0) this.bossTimer = 0;
  },

  updateRelease(dt) {
    // just a fade moment before menu return
    this.flowers = this.flowers.filter(f => f.life > 0);
  },

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt * 1000;
      if (p.type === 'pixel' || p.type === 'text' || p.type === 'warning') {
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
      }
    }
    this.particles = this.particles.filter(p => p.life > 0);
  },

  intersectRect(a, b) {
    return a.x < b.x + b.w &&
           a.x + (a.w || a.r * 2) > b.x &&
           a.y < b.y + b.h &&
           a.y + (a.h || a.r * 2) > b.y;
  },

  intersectCircleRect(circle, rect) {
    const cx = clamp(circle.x, rect.x, rect.x + rect.w);
    const cy = clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - cx;
    const dy = circle.y - cy;
    return dx * dx + dy * dy < circle.r * circle.r;
  },

  drawBootFrame() {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
  },

  drawMenuFrame() {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#111';
    for (let i = 0; i < 24; i++) {
      c.fillRect(rint(0, W - 1), rint(0, H - 1), 2, 2);
    }
  },

  draw(t) {
    const c = this.ctx;
    c.save();

    if (this.shake > 0) {
      const sx = rand(-this.shake, this.shake);
      const sy = rand(-this.shake, this.shake);
      c.translate(sx, sy);
      this.shake *= 0.88;
      if (this.shake < 0.3) this.shake = 0;
    }

    c.clearRect(0, 0, W, H);
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);

    this.drawStars(c);

    if (this.phase === 'boss' || this.phase === 'choice' || this.phase === 'reclaim') {
      this.drawBossSprite(c, this.phase === 'reclaim' ? 1 - Math.min(1, (this.bossTimer / 1000)) : 1);
    }

    if (this.phase === 'reclaim') {
      this.drawBossBurst(c);
    }

    if (this.phase === 'release') {
      this.drawReleaseFade(c);
    }

    if (this.phase === 'breakout' || this.phase === 'endless') {
      this.drawBricks(c);
      this.drawItems(c);
    }

    if (this.phase === 'boss') {
      this.drawBossArena(c);
      this.drawBlasters(c, t);
    }

    this.drawPaddle(c);
    this.drawBalls(c);
    this.drawFlowers(c);
    this.drawFollowers(c);
    this.drawParticles(c);

    if (this.phase === 'transition') {
      this.drawTransitionText(c);
    }

    if (this.phase === 'choice') {
      this.drawClimaxText(c);
    }

    if (this.state === 'gameover') {
      this.drawGameOver(c);
    }

    c.restore();
  },

  drawStars(c) {
    c.fillStyle = '#081018';
    for (let i = 0; i < 60; i++) {
      const x = (i * 73 + (this.round * 17)) % W;
      const y = (i * 151 + (this.wave * 19)) % H;
      c.fillRect(x, y, 1, 1);
    }
  },

  drawBossArena(c) {
    c.fillStyle = 'rgba(255,255,255,0.04)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#220000';
    c.fillRect(0, 0, W, 70);
  },

  drawBricks(c) {
    for (const brick of this.bricks) {
      const shade = 60 + brick.row * 18;
      c.fillStyle = `rgb(${shade},${Math.max(20, shade - 20)},${Math.max(20, shade - 40)})`;
      c.fillRect(brick.x, brick.y, brick.w, brick.h);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, 3);
    }
  },

  drawItems(c) {
    for (const item of this.items) {
      let col = '#fff';
      if (item.type === 'slow') col = '#66ffff';
      if (item.type === 'grow') col = '#66ff66';
      if (item.type === 'star') col = '#ffff66';
      if (item.type === 'bomb') col = '#ff6666';

      c.fillStyle = col;
      c.fillRect(item.x, item.y, item.w, item.h);
      c.fillStyle = '#000';
      c.fillRect(item.x + 4, item.y + 4, 2, 2);
      c.fillRect(item.x + 8, item.y + 4, 2, 2);
      c.fillRect(item.x + 4, item.y + 8, 6, 2);
    }
  },

  drawPaddle(c) {
    c.fillStyle = '#fff';
    c.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    c.fillStyle = '#000';
    c.fillRect(this.paddle.x + 4, this.paddle.y + 4, this.paddle.w - 8, 3);
  },

  drawBalls(c) {
    for (const ball of this.balls) {
      for (let i = 0; i < ball.trail.length; i++) {
        const p = ball.trail[i];
        const alpha = i / ball.trail.length;
        c.fillStyle = `rgba(255,255,255,${alpha * 0.25})`;
        c.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      c.fill();
    }
  },

  drawBossSprite(c) {
    const x = W / 2 - 40;
    const y = 22;
    c.fillStyle = '#000';
    c.fillRect(x - 6, y - 6, 92, 82);
    c.fillStyle = '#fff';
    c.fillRect(x + 10, y + 10, 60, 52);
    c.fillStyle = '#000';
    c.fillRect(x + 20, y + 22, 8, 8);
    c.fillRect(x + 44, y + 22, 8, 8);
    c.fillRect(x + 24, y + 38, 24, 4);
    c.fillStyle = '#ff0000';
    c.fillRect(x + 0, y + 4, 12, 12);
    c.fillRect(x + 68, y + 4, 12, 12);
    c.fillRect(x + 4, y + 16, 6, 6);
    c.fillRect(x + 72, y + 16, 6, 6);
  },

  drawBossBurst(c) {
    const life = 1 - Math.min(1, this.particles.find(p => p.type === 'boss-burst') ? this.particles.find(p => p.type === 'boss-burst').life / 900 : 1);
    const r = 30 + life * 100;
    c.strokeStyle = `rgba(255,255,255,${1 - life})`;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(W / 2, 128, r, 0, Math.PI * 2);
    c.stroke();
  },

  drawBlasters(c, t) {
    for (const b of this.blasters) {
      const isFire = b.phase === 'fire';
      if (b.phase === 'telegraph') {
        c.fillStyle = 'rgba(255,0,0,0.3)';
        c.fillRect(b.x - 1, 0, 2, H);
        c.fillStyle = '#ff0000';
        c.fillRect(b.x - 3, 10, 6, 14);
        c.fillStyle = '#fff';
        c.fillRect(b.x - 2, 14, 4, 4);
      } else if (isFire) {
        c.fillStyle = 'rgba(0,255,255,0.15)';
        c.fillRect(b.x - b.beamW / 2 - 6, 0, b.beamW + 12, H);
        c.fillStyle = '#00ffff';
        c.fillRect(b.x - b.beamW / 2, 0, b.beamW, H);
        c.fillStyle = '#ff00ff';
        c.fillRect(b.x - b.beamW / 2 + 2, 0, 2, H);
        c.fillRect(b.x + b.beamW / 2 - 4, 0, 2, H);
      }
    }
  },

  drawFlowers(c) {
    for (const f of this.flowers) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      c.fillStyle = `rgba(255,255,255,${alpha})`;
      c.fillRect(f.x, f.y + 8, 10, 2);
      c.fillStyle = `rgba(255,255,0,${alpha})`;
      c.fillRect(f.x + 4, f.y + 2, 2, 8);
      c.fillRect(f.x + 1, f.y + 5, 8, 2);
    }
  },

  drawFollowers(c) {
    for (const f of this.followers) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      c.fillStyle = `rgba(255,255,255,${alpha})`;
      c.fillRect(f.x, f.y, 8, 8);
      c.fillStyle = `rgba(0,255,0,${alpha})`;
      c.fillRect(f.x + 2, f.y + 2, 2, 2);
      c.fillRect(f.x + 5, f.y + 2, 2, 2);
      c.fillStyle = `rgba(255,255,0,${alpha})`;
      c.fillRect(f.x + 3, f.y + 6, 2, 2);
    }
  },

  drawParticles(c) {
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'text') {
        c.fillStyle = `rgba(255,255,255,${alpha})`;
        c.font = '12px "Press Start 2P"';
        c.textAlign = 'center';
        c.fillText(p.text, p.x, p.y);
      } else if (p.type === 'warning') {
        c.strokeStyle = `rgba(255,0,0,${alpha})`;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(p.x, 0);
        c.lineTo(p.x, H);
        c.stroke();
      } else {
        c.fillStyle = p.color || `rgba(255,255,255,${alpha})`;
        c.fillRect(p.x | 0, p.y | 0, 2, 2);
      }
    }
  },

  drawTransitionText(c) {
    c.fillStyle = '#fff';
    c.font = '12px "Press Start 2P"';
    c.textAlign = 'center';
    c.fillText('THE REAL TRIAL BEGINS NOW', W / 2, H / 2 + 70);
  },

  drawClimaxText(c) {
    c.fillStyle = '#fff';
    c.font = '12px "Press Start 2P"';
    c.textAlign = 'center';
    c.fillText('RECLAIM OR RELEASE', W / 2, H / 2 + 70);
  },

  drawReleaseFade(c) {
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(0, 0, W, H);
  },

  drawGameOver(c) {
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    c.font = '18px "Press Start 2P"';
    c.textAlign = 'center';
    c.fillText('GAME OVER', W / 2, H / 2 - 10);
    c.font = '10px "Press Start 2P"';
    c.fillText(`FINAL SCORE: ${this.score}`, W / 2, H / 2 + 24);
  },

  loop(timestamp) {
    const t = timestamp || now();
    if (!this.lastFrameTime) this.lastFrameTime = t;
    const dt = clamp((t - this.lastFrameTime) / 1000, 0, 0.033);
    this.lastFrameTime = t;

    if (this.state !== 'menu') {
      this.update(dt, t);
      this.draw(t);
    } else {
      this.drawMenuFrame();
    }

    requestAnimationFrame(this.loop.bind(this));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});