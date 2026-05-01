const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const EFFECT_DURATION = 5000;

/* ================= AUDIO ================= */
const AudioSys = {
    musicVol: 0.5, sfxVol: 0.5,
    sounds: {
        menu: new Audio('menu.ogg'),
        battle: new Audio('battle.ogg'),
        boss: new Audio('Megalovania.mp3'),
        talk: new Audio('just-sans-talking.mp3'),
        blast: new Audio('gaster_blaster.mp3')
    },

    init() {
        Object.values(this.sounds).forEach(s => {
            s.volume = 0;
            s.play().then(() => s.pause()).catch(() => {});
        });

        this.updateVolumes();

        this.sounds.menu.loop = true;
        this.sounds.battle.loop = true;
        this.sounds.boss.loop = true;
        this.sounds.talk.loop = true;
    },

    updateVolumes() {
        this.musicVol = document.getElementById('vol-music').value;
        this.sfxVol = document.getElementById('vol-sfx').value;

        this.sounds.menu.volume = this.musicVol;
        this.sounds.battle.volume = this.musicVol;
        this.sounds.boss.volume = this.musicVol;
        this.sounds.talk.volume = this.sfxVol;
        this.sounds.blast.volume = this.sfxVol;
    },

    playMusic(track) {
        this.stopAllMusic();
        let t = this.sounds[track];
        t.currentTime = 0;
        t.volume = this.musicVol;
        t.play().catch(() => {});
    },

    stopAllMusic() {
        ['menu', 'battle', 'boss'].forEach(t => this.sounds[t].pause());
    },

    playSFX(track) {
        let t = this.sounds[track];
        t.currentTime = 0;
        t.volume = this.sfxVol;
        t.play().catch(() => {});
    },

    playTalkLoop() {
        let t = this.sounds.talk;
        if (t.paused) {
            t.currentTime = 0;
            t.volume = this.sfxVol;
            t.play().catch(() => {});
        }
    },

    stopTalkLoop() {
        let t = this.sounds.talk;
        t.pause();
        t.currentTime = 0;
    }
};

/* ================= INPUT ================= */
const Input = {
    mouseX: GAME_WIDTH / 2,
    keys: {},
    platform: 'pc',

    init(platform) {
        this.platform = platform;

        window.addEventListener('keydown', e => this.keys[e.key] = true);
        window.addEventListener('keyup', e => this.keys[e.key] = false);

        if (platform === 'pc') {
            canvas.addEventListener('mousemove', e => {
                const rect = canvas.getBoundingClientRect();
                this.mouseX = (e.clientX - rect.left) * (GAME_WIDTH / rect.width);
            });
        } else {
            const track = document.getElementById('touch-track');

            const move = (x) => {
                const rect = track.getBoundingClientRect();
                let pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
                this.mouseX = pct * GAME_WIDTH;
            };

            track.addEventListener('touchstart', e => {
                e.preventDefault();
                move(e.touches[0].clientX);
            }, { passive: false });

            track.addEventListener('touchmove', e => {
                e.preventDefault();
                move(e.touches[0].clientX);
            }, { passive: false });
        }
    }
};

/* ================= ENTITIES ================= */
class Paddle {
    constructor() {
        this.w = 80;
        this.h = 15;
        this.x = GAME_WIDTH / 2 - 40;
        this.y = GAME_HEIGHT - 60;
        this.speed = 8;
    }

    update() {
        if (Input.platform === 'pc' && Input.keys['ArrowLeft']) this.x -= this.speed;
        else if (Input.platform === 'pc' && Input.keys['ArrowRight']) this.x += this.speed;
        else this.x += (Input.mouseX - this.w / 2 - this.x) * 0.3;

        this.x = Math.max(0, Math.min(GAME_WIDTH - this.w, this.x));
    }

    draw() {
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.w, this.h);
    }
}

class Ball {
    constructor(x, y, dx, dy) {
        this.x = x;
        this.y = y;
        this.r = 6;
        this.dx = dx;
        this.dy = dy;
    }

    update(paddle) {
        this.x += this.dx;
        this.y += this.dy;

        if (this.x < this.r || this.x > GAME_WIDTH - this.r) this.dx *= -1;
        if (this.y < this.r) this.dy *= -1;

        if (
            this.y + this.r > paddle.y &&
            this.x > paddle.x &&
            this.x < paddle.x + paddle.w &&
            this.dy > 0
        ) {
            this.dy *= -1;
            let hit = (this.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            this.dx = hit * 5;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
}

class Brick {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 60;
        this.h = 20;
        this.active = true;
    }

    draw() {
        if (!this.active) return;
        ctx.fillStyle = '#aaa';
        ctx.fillRect(this.x, this.y, this.w, this.h);
    }
}

class Blaster {
    constructor() {
        this.x = Math.random() * (GAME_WIDTH - 90);
        this.w = 90;
        this.state = 'warn';
        this.timer = 75;
        this.hit = false;
    }

    update(paddle) {
        this.timer--;

        if (this.timer === 50) {
            this.state = 'charge';
            AudioSys.playSFX('blast');
        }
        if (this.timer === 35) this.state = 'fire';
        if (this.timer <= 0) return true;

        if (this.state === 'fire' && !this.hit) {
            let beamX = this.x + 25;
            let beamW = this.w - 50;

            if (paddle.x < beamX + beamW && paddle.x + paddle.w > beamX) {
                this.hit = true;
                Game.takeDamage(0.1);
            }
        }

        return false;
    }

    draw() {
        if (this.state === 'warn') {
            ctx.fillStyle = 'rgba(255,0,0,0.1)';
            ctx.fillRect(this.x, 0, this.w, GAME_HEIGHT);
        }
        if (this.state === 'charge') {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(this.x + 40, 0, 10, GAME_HEIGHT);
        }
        if (this.state === 'fire') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x + 40, 0, 10, GAME_HEIGHT);
        }
    }
}

/* ================= GAME ================= */
const Game = {
    state: 'BOOT',
    maxHp: 100,
    hp: 100,
    score: 0,
    timer: 120,

    paddle: null,
    balls: [],
    bricks: [],
    blasters: [],

    init() {
        document.getElementById('boot-screen').onclick = () => {
            AudioSys.init();
            document.getElementById('boot-screen').classList.remove('active');
            document.getElementById('menu-screen').classList.add('active');
            AudioSys.playMusic('menu');
            this.state = 'MENU';
        };

        document.getElementById('btn-pc').onclick = () => this.start('pc');
        document.getElementById('btn-mobile').onclick = () => this.start('mobile');

        requestAnimationFrame(() => this.loop());
    },

    start(platform) {
        Input.init(platform);
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('hud').classList.remove('hidden');

        if (platform === 'mobile')
            document.getElementById('mobile-controls').classList.remove('hidden');

        this.hp = this.maxHp;
        this.score = 0;

        this.paddle = new Paddle();
        this.balls = [new Ball(240, 300, 4, -4)];

        this.generateBricks();

        this.state = 'PLAY';
        AudioSys.playMusic('battle');
    },

    generateBricks() {
        this.bricks = [];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 7; c++) {
                this.bricks.push(new Brick(15 + c * 70, 60 + r * 30));
            }
        }
    },

    takeDamage(d) {
        this.hp -= d;
        if (this.hp <= 0) location.reload();
    },

    startDialogue() {
        this.state = 'DIALOGUE';
        AudioSys.stopAllMusic();

        const lines = [
            "YOU DID WELL.",
            "BUT THIS IS NOT OVER.",
            "SURVIVE."
        ];

        let i = 0;
        let box = document.getElementById('dialogue-box');
        let text = document.getElementById('dialogue-text');

        box.classList.remove('hidden');

        const next = () => {
            if (i >= lines.length) {
                box.classList.add('hidden');
                this.startBoss();
                return;
            }

            text.innerText = "";
            let t = lines[i];
            let c = 0;

            AudioSys.playTalkLoop();

            let interval = setInterval(() => {
                text.innerText += t[c++];
                if (c >= t.length) {
                    clearInterval(interval);
                    AudioSys.stopTalkLoop();
                    i++;
                    setTimeout(next, 1000);
                }
            }, 40);
        };

        next();
    },

    startBoss() {
        this.state = 'BOSS';
        this.timer = 140;
        AudioSys.playMusic('boss');
    },

    loop() {
        requestAnimationFrame(() => this.loop());

        if (this.state === 'MENU' || this.state === 'BOOT') return;

        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        this.paddle.update();
        this.paddle.draw();

        for (let b of this.balls) {
            b.update(this.paddle);
            b.draw();

            for (let br of this.bricks) {
                if (
                    br.active &&
                    b.x + b.r > br.x &&
                    b.x - b.r < br.x + br.w &&
                    b.y + b.r > br.y &&
                    b.y - b.r < br.y + br.h
                ) {
                    br.active = false;
                    b.dy *= -1;
                    this.score++;
                }
            }
        }

        this.bricks.forEach(b => b.draw());

        if (this.bricks.every(b => !b.active) && this.state === 'PLAY')
            this.startDialogue();

        if (this.state === 'BOSS') {
            if (Math.random() < 0.02)
                this.blasters.push(new Blaster());

            for (let i = this.blasters.length - 1; i >= 0; i--) {
                if (this.blasters[i].update(this.paddle))
                    this.blasters.splice(i, 1);
                else this.blasters[i].draw();
            }
        }
    }
};

window.onload = () => Game.init();