/**
 * BOMB BREAKOUT: DETERMINATION ENGINE v4.0
 * FULL SOURCE CODE - 500+ LINES
 * 
 * Features:
 * - 100 HP System
 * - 5s Power-up Durations
 * - Multi-line Dialogue wrapping
 * - Drag-anywhere Mobile Controls
 * - Intense Neon Blaster Effects
 */

// --- GLOBAL CONSTANTS & CONFIG ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const CONFIG = {
    PADDLE_WIDTH: 90,
    PADDLE_HEIGHT: 16,
    BALL_RADIUS: 7,
    BRICK_ROWS: 5,
    BRICK_COLS: 7,
    MAX_HP: 100,
    BOSS_TIME: 90, // Seconds
    POWERUP_DURATION: 5000 // 5 Seconds
};

// --- AUDIO SYSTEM ---
// Maps to the exact files in your explorer: image_3d3018.png
const AudioSys = {
    musicVol: 0.5, sfxVol: 0.5,
    sounds: {
        menu: new Audio('menu.ogg'),
        battle: new Audio('battle.ogg'),
        boss: new Audio('Megalovania.mp3'),
        talk: new Audio('just-sans-talking.mp3'),
        blast: new Audio('gaster_blaster.mp3'),
        start: new Audio('battle-start.mp3'),
        lose: new Audio('lose.ogg')
    },
    init() {
        Object.values(this.sounds).forEach(s => {
            s.volume = 0;
            s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(() => {});
        });
        this.updateVolumes();
        this.sounds.menu.loop = true;
        this.sounds.battle.loop = true;
        this.sounds.boss.loop = true;
    },
    updateVolumes() {
        this.musicVol = parseFloat(document.getElementById('vol-music').value);
        this.sfxVol = parseFloat(document.getElementById('vol-sfx').value);
        for(let key in this.sounds) {
            this.sounds[key].volume = ['menu','battle','boss'].includes(key) ? this.musicVol : this.sfxVol;
        }
    },
    playMusic(track) {
        this.stopAllMusic();
        this.sounds[track].currentTime = 0;
        this.sounds[track].play();
    },
    stopAllMusic() {
        ['menu','battle','boss'].forEach(k => this.sounds[k].pause());
    },
    playSFX(track) {
        // Repeated sound check for dialogue to prevent "ear-rape"
        if(track === 'talk' && !this.sounds.talk.paused) return;
        this.sounds[track].currentTime = 0;
        this.sounds[track].play();
    }
};

// --- INPUT SYSTEM ---
const Input = {
    mouseX: GAME_WIDTH / 2,
    keys: {},
    isMobile: false,
    init(isMobile) {
        this.isMobile = isMobile;
        window.addEventListener('keydown', e => this.keys[e.key] = true);
        window.addEventListener('keyup', e => this.keys[e.key] = false);

        if (!isMobile) {
            canvas.addEventListener('mousemove', e => {
                const rect = canvas.getBoundingClientRect();
                this.mouseX = (e.clientX - rect.left) * (GAME_WIDTH / rect.width);
            });
        } else {
            // DRAG ANYWHERE CONTROL: No literal slider
            const handleTouch = (e) => {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const touchX = e.touches[0].clientX - rect.left;
                this.mouseX = (touchX / rect.width) * GAME_WIDTH;
            };
            canvas.addEventListener('touchstart', handleTouch, {passive: false});
            canvas.addEventListener('touchmove', handleTouch, {passive: false});
        }
    }
};

// --- ENTITIES ---

/**
 * PADDLE: The player's shield/soul
 */
class Paddle {
    constructor() {
        this.w = CONFIG.PADDLE_WIDTH;
        this.h = CONFIG.PADDLE_HEIGHT;
        this.reset();
        this.color = '#fff';
    }
    reset() {
        this.x = GAME_WIDTH / 2 - this.w / 2;
        this.y = GAME_HEIGHT - 60;
    }
    update() {
        // Smoothly follow input, no snapping to center
        let targetX = Input.mouseX - this.w / 2;
        this.x += (targetX - this.x) * 0.35;

        if (this.x < 0) this.x = 0;
        if (this.x + this.w > GAME_WIDTH) this.x = GAME_WIDTH - this.w;
    }
    draw(c) {
        c.fillStyle = this.color;
        c.fillRect(this.x, this.y, this.w, this.h);
        c.strokeStyle = '#000';
        c.strokeRect(this.x, this.y, this.w, this.h);
    }
}

/**
 * BALL: The projectile
 */
class Ball {
    constructor(x, y, dx, dy) {
        this.x = x; this.y = y; this.dx = dx; this.dy = dy;
        this.r = CONFIG.BALL_RADIUS;
    }
    update(paddle) {
        this.x += this.dx;
        this.y += this.dy;

        // Walls
        if (this.x - this.r < 0 || this.x + this.r > GAME_WIDTH) this.dx *= -1;
        if (this.y - this.r < 0) this.dy *= -1;

        // Paddle Collision
        if (this.y + this.r > paddle.y && this.y - this.r < paddle.y + paddle.h &&
            this.x > paddle.x && this.x < paddle.x + paddle.w && this.dy > 0) {
            this.dy *= -1;
            this.y = paddle.y - this.r; // Anti-stuck
            // Physics: English based on where you hit the paddle
            let hitFactor = (this.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            this.dx = hitFactor * 6;
        }
    }
    draw(c) {
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        c.fill();
    }
}

/**
 * INTENSE BLASTER: The boss attack
 */
class IntenseBlaster {
    constructor() {
        this.w = 70;
        this.x = Math.random() * (GAME_WIDTH - this.w);
        this.timer = 120; // 2 seconds total
        this.state = 'warn'; // warn -> charge -> fire
    }
    update(paddle) {
        this.timer--;
        if (this.timer === 45) {
            this.state = 'charge';
            AudioSys.playSFX('blast');
        }
        if (this.timer === 30) this.state = 'fire';
        
        // COLLISION CHECK: Only hurts you if it is in 'fire' state
        if (this.state === 'fire') {
            if (paddle.x < this.x + this.w && paddle.x + paddle.w > this.x) {
                Game.takeDamage(0.8); // Drains HP quickly
            }
        }
        return this.timer <= 0;
    }
    draw(c) {
        if (this.state === 'warn') {
            c.fillStyle = `rgba(255, 0, 0, ${Math.sin(this.timer * 0.1) * 0.3 + 0.3})`;
            c.fillRect(this.x, 0, this.w, GAME_HEIGHT);
            c.font = '20px serif';
            c.fillText('!', this.x + this.w/2 - 5, 40);
        } else if (this.state === 'charge') {
            c.fillStyle = 'rgba(255, 255, 255, 0.4)';
            c.fillRect(this.x + 20, 0, this.w - 40, GAME_HEIGHT);
        } else if (this.state === 'fire') {
            // Neon Glow Effect
            c.shadowBlur = 15; c.shadowColor = '#0ff';
            c.fillStyle = '#fff';
            c.fillRect(this.x, 0, this.w, GAME_HEIGHT);
            c.shadowBlur = 0;
            // Core
            c.fillStyle = '#e0ffff';
            c.fillRect(this.x + 15, 0, this.w - 30, GAME_HEIGHT);
        }
    }
}

/**
 * POWER-UPS & PARTICLES
 */
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random()-0.5) * 8;
        this.vy = (Math.random()-0.5) * 8;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.life -= 0.04;
        return this.life <= 0;
    }
    draw(c) {
        c.globalAlpha = this.life;
        c.fillStyle = this.color;
        c.fillRect(this.x, this.y, 3, 3);
        c.globalAlpha = 1;
    }
}

// --- MAIN GAME ENGINE ---
const Game = {
    state: 'BOOT', // BOOT, MENU, PLAY, DIALOGUE, BOSS, END, PAUSED
    hp: CONFIG.MAX_HP,
    score: 0,
    hiScore: parseInt(localStorage.getItem('bomb_hi')) || 0,
    timer: CONFIG.BOSS_TIME,
    shake: 0,

    // Collections
    paddle: new Paddle(),
    balls: [],
    bricks: [],
    blasters: [],
    particles: [],
    drops: [],

    init() {
        // Event Listeners
        document.getElementById('boot-screen').onclick = () => {
            AudioSys.init();
            this.state = 'MENU';
            this.updateMenu();
            AudioSys.playMusic('menu');
        };

        document.getElementById('btn-pc').onclick = () => this.start(false);
        document.getElementById('btn-mobile').onclick = () => this.start(true);
        document.getElementById('vol-music').oninput = () => AudioSys.updateVolumes();
        document.getElementById('vol-sfx').oninput = () => AudioSys.updateVolumes();
        
        document.getElementById('btn-kill').onclick = () => location.reload();
        document.getElementById('btn-spare').onclick = () => {
            alert("KINDNESS IS KEY. YOU SPARED THE BOMB.");
            location.reload();
        };

        // Start Loop
        this.loop();
    },

    updateMenu() {
        document.getElementById('boot-screen').classList.remove('active');
        document.getElementById('menu-screen').classList.add('active');
    },

    start(isMobile) {
        Input.init(isMobile);
        AudioSys.playSFX('start');
        
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('hud').classList.remove('hidden');

        this.hp = CONFIG.MAX_HP;
        this.score = 0;
        this.updateUI();

        this.balls = [new Ball(GAME_WIDTH/2, GAME_HEIGHT/2, 4, -4)];
        this.generateBricks();
        
        this.state = 'PLAY';
        AudioSys.playMusic('battle');
    },

    generateBricks() {
        this.bricks = [];
        const padding = 10;
        const offTop = 80;
        const offLeft = 15;
        for(let r=0; r<CONFIG.BRICK_ROWS; r++) {
            for(let c=0; c<CONFIG.BRICK_COLS; c++) {
                this.bricks.push({
                    x: offLeft + c*(60 + padding),
                    y: offTop + r*(20 + padding),
                    w: 60, h: 20, active: true
                });
            }
        }
    },

    takeDamage(amt) {
        this.hp -= amt;
        this.shake = 10;
        if(this.hp <= 0) {
            this.hp = 0;
            this.gameOver();
        }
        this.updateUI();
    },

    updateUI() {
        document.getElementById('ui-hp').innerText = `${Math.ceil(this.hp)}/${CONFIG.MAX_HP}`;
        document.getElementById('hp-bar-fill').style.width = `${(this.hp/CONFIG.MAX_HP)*100}%`;
        document.getElementById('ui-score').innerText = this.score;
        document.getElementById('ui-hiscore').innerText = this.hiScore;
        
        if(this.score > this.hiScore) {
            this.hiScore = this.score;
            localStorage.setItem('bomb_hi', this.hiScore);
        }
    },

    gameOver() {
        this.state = 'END';
        AudioSys.stopAllMusic();
        AudioSys.playSFX('lose');
        setTimeout(() => {
            alert("DETERMINATION EXHAUSTED.");
            location.reload();
        }, 1500);
    },

    startDialogue() {
        this.state = 'DIALOGUE';
        AudioSys.stopAllMusic();
        this.balls = [];
        this.drops = [];

        const lines = [
            "HEY! THAT WAS MY COLLECTION!",
            "YOU BROKE EVERY SINGLE ONE...",
            "DO YOU KNOW HOW HARD IT IS TO STACK BRICKS WITHOUT ARMS?",
            "WHATEVER. YOU'RE ABOUT TO FEEL THE HEAT.",
            "PREPARE TO BE BLASTED!"
        ];

        document.getElementById('dialogue-box').classList.remove('hidden');
        let currentLine = 0;

        const next = () => {
            if (currentLine >= lines.length) {
                document.getElementById('dialogue-box').classList.add('hidden');
                this.startBoss();
                return;
            }

            let text = lines[currentLine];
            let el = document.getElementById('dialogue-text');
            el.innerText = "";
            let i = 0;

            let interval = setInterval(() => {
                el.innerText += text[i];
                AudioSys.playSFX('talk');
                i++;
                if (i >= text.length) {
                    clearInterval(interval);
                    currentLine++;
                    setTimeout(next, 1200);
                }
            }, 50);
        };
        next();
    },

    startBoss() {
        this.state = 'BOSS';
        this.timer = CONFIG.BOSS_TIME;
        this.paddle.color = '#f00'; // Soul turns red
        this.balls = [new Ball(GAME_WIDTH/2, GAME_HEIGHT/2, 5, -5)];
        document.getElementById('ui-timer').classList.remove('hidden');
        AudioSys.playMusic('boss'); // MEGALOVANIA!
    },

    applyPowerup(type) {
        if(type === 'S') { // Slow
            this.balls.forEach(b => { b.dx *= 0.6; b.dy *= 0.6; });
            setTimeout(() => this.balls.forEach(b => { b.dx /= 0.6; b.dy /= 0.6; }), CONFIG.POWERUP_DURATION);
        }
        if(type === 'M') { // Mushroom (Big Paddle)
            this.paddle.w = 160;
            setTimeout(() => this.paddle.w = CONFIG.PADDLE_WIDTH, CONFIG.POWERUP_DURATION);
        }
        if(type === 'G') { // Ghost (Extra Ball)
            this.balls.push(new Ball(this.paddle.x, this.paddle.y - 10, 3, -4));
            setTimeout(() => { if(this.balls.length > 1) this.balls.pop(); }, CONFIG.POWERUP_DURATION);
        }
    },

    spawnEffects(x, y) {
        // Particles
        for(let i=0; i<8; i++) this.particles.push(new Particle(x+30, y+10, '#fff'));
        // Drop Chance
        if(Math.random() < 0.2) {
            const types = ['S', 'M', 'G'];
            this.drops.push({
                x: x+20, y: y, 
                type: types[Math.floor(Math.random()*types.length)]
            });
        }
    },

    // --- MAIN LOOP ---
    loop() {
        requestAnimationFrame(() => this.loop());

        if (['BOOT','MENU','DIALOGUE','PAUSED'].includes(this.state)) return;

        // Screen Shake
        ctx.save();
        if(this.shake > 0) {
            ctx.translate((Math.random()-0.5)*this.shake, (Math.random()-0.5)*this.shake);
            this.shake--;
        }

        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Update Paddle
        this.paddle.update();
        this.paddle.draw(ctx);

        // Balls
        for(let i = this.balls.length-1; i>=0; i--) {
            let b = this.balls[i];
            b.update(this.paddle);
            b.draw(ctx);

            // Brick Collision
            if(this.state === 'PLAY') {
                this.bricks.forEach(br => {
                    if(br.active && b.x > br.x && b.x < br.x+br.w && b.y > br.y && b.y < br.y+br.h) {
                        br.active = false;
                        b.dy *= -1;
                        this.score += 10;
                        this.updateUI();
                        this.spawnEffects(br.x, br.y);
                    }
                });
            }

            // Floor check: DODGE CHECK INCLUDED
            if(b.y > GAME_HEIGHT) {
                this.balls.splice(i, 1);
                // Only take damage if the last ball is lost
                if(this.balls.length === 0) {
                    this.takeDamage(10); 
                    if(this.hp > 0) this.balls.push(new Ball(GAME_WIDTH/2, GAME_HEIGHT/2, 4, -4));
                }
            }
        }

        // Bricks Rendering
        if(this.state === 'PLAY') {
            this.bricks.forEach(br => {
                if(br.active) {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(br.x, br.y, br.w, br.h);
                    ctx.strokeStyle = '#333';
                    ctx.strokeRect(br.x, br.y, br.w, br.h);
                }
            });
            if(this.bricks.every(br => !br.active)) this.startDialogue();
        }

        // Drops
        for(let i = this.drops.length-1; i>=0; i--) {
            let d = this.drops[i];
            d.y += 2.5;
            ctx.fillStyle = '#0f0';
            ctx.font = '20px serif';
            ctx.fillText(d.type, d.x, d.y);
            // Catch check
            if(d.y > this.paddle.y && d.y < this.paddle.y+this.paddle.h && 
               d.x > this.paddle.x && d.x < this.paddle.x + this.paddle.w) {
                this.applyPowerup(d.type);
                this.drops.splice(i, 1);
            } else if (d.y > GAME_HEIGHT) this.drops.splice(i, 1);
        }

        // Particles
        for(let i = this.particles.length-1; i>=0; i--) {
            if(this.particles[i].update()) this.particles.splice(i,1);
            else this.particles[i].draw(ctx);
        }

        // Boss Phase Logic
        if(this.state === 'BOSS') {
            this.timer -= 1/60;
            let m = Math.floor(this.timer/60);
            let s = Math.floor(this.timer%60);
            document.getElementById('ui-timer').innerText = `${m}:${s.toString().padStart(2,'0')}`;

            // Blaster Spawning
            if(Math.random() < 0.03) this.blasters.push(new IntenseBlaster());

            for(let i = this.blasters.length-1; i>=0; i--) {
                if(this.blasters[i].update(this.paddle)) this.blasters.splice(i, 1);
                else this.blasters[i].draw(ctx);
            }

            if(this.timer <= 0) {
                this.state = 'PAUSED';
                AudioSys.stopAllMusic();
                document.getElementById('choice-screen').classList.add('active');
            }
        }

        ctx.restore();
    }
};

window.onload = () => Game.init();