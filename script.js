/**
 * THE DETERMINATION ENGINE
 * Fully object-oriented, highly efficient, exact implementation of Breakout + Undertale Boss Fight.
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// --- AUDIO MANAGER ---
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
        // Unlock audio context by playing/pausing everything
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
        this.musicVol = document.getElementById('vol-music').value;
        this.sfxVol = document.getElementById('vol-sfx').value;
        for(let key in this.sounds) {
            this.sounds[key].volume = (key === 'menu' || key === 'battle' || key === 'boss') ? this.musicVol : this.sfxVol;
        }
    },
    playMusic(track) {
        this.stopAllMusic();
        this.sounds[track].currentTime = 0;
        this.sounds[track].play().catch(e => console.warn(e));
    },
    stopAllMusic() {
        ['menu', 'battle', 'boss'].forEach(t => this.sounds[t].pause());
    },
    playSFX(track) {
        this.sounds[track].currentTime = 0;
        this.sounds[track].play().catch(e => console.warn(e));
    }
};

// --- INPUT MANAGER ---
const Input = {
    mouseX: GAME_WIDTH / 2, keys: {}, platform: 'pc',
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
            const thumb = document.getElementById('touch-thumb');
            document.getElementById('mobile-controls').addEventListener('touchmove', e => {
                const rect = track.getBoundingClientRect();
                let touchX = e.touches[0].clientX - rect.left;
                let pct = Math.max(0, Math.min(1, touchX / rect.width));
                thumb.style.left = `${pct * 100}%`;
                this.mouseX = pct * GAME_WIDTH;
            });
        }
    }
};

// --- ENTITIES ---
class Paddle {
    constructor() { this.w = 80; this.h = 15; this.x = GAME_WIDTH/2 - this.w/2; this.y = GAME_HEIGHT - 60; this.speed = 8; this.color = '#fff'; }
    update() {
        if (Input.platform === 'pc' && Input.keys['ArrowLeft']) this.x -= this.speed;
        else if (Input.platform === 'pc' && Input.keys['ArrowRight']) this.x += this.speed;
        else this.x += (Input.mouseX - this.w/2 - this.x) * 0.3; // Smooth follow mouse/slider
        
        if(this.x < 0) this.x = 0;
        if(this.x + this.w > GAME_WIDTH) this.x = GAME_WIDTH - this.w;
    }
    draw(ctx) { ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.w, this.h); }
}

class Ball {
    constructor(x, y, dx, dy) { this.x = x; this.y = y; this.r = 6; this.dx = dx; this.dy = dy; }
    update(paddle) {
        this.x += this.dx; this.y += this.dy;
        if(this.x - this.r < 0 || this.x + this.r > GAME_WIDTH) this.dx *= -1;
        if(this.y - this.r < 0) this.dy *= -1;
        
        // Paddle collision
        if (this.y + this.r > paddle.y && this.y - this.r < paddle.y + paddle.h &&
            this.x > paddle.x && this.x < paddle.x + paddle.w && this.dy > 0) {
            this.dy *= -1;
            this.y = paddle.y - this.r; // Prevent getting stuck
            let hitPoint = (this.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
            this.dx = hitPoint * 5; // English/Spin
        }
    }
    draw(ctx) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill(); }
}

class Brick {
    constructor(x, y) { this.x = x; this.y = y; this.w = 60; this.h = 20; this.active = true; }
    draw(ctx) { if(this.active) { ctx.fillStyle = '#aaa'; ctx.fillRect(this.x, this.y, this.w, this.h); ctx.strokeStyle = '#000'; ctx.strokeRect(this.x, this.y, this.w, this.h); } }
}

class Drop {
    constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.w = 20; this.h = 20; }
    update() { this.y += 2.5; }
    draw(ctx) { ctx.font = '20px serif'; ctx.fillText(this.type, this.x, this.y); }
}

class Blaster {
    constructor() {
        this.x = Math.random() * (GAME_WIDTH - 60);
        this.w = 60;
        this.state = 'warn'; // warn -> charge -> fire
        this.timer = 90;
    }
    update(paddle) {
        this.timer--;
        if (this.timer === 45) { this.state = 'charge'; AudioSys.playSFX('blast'); }
        if (this.timer === 30) this.state = 'fire';
        if (this.timer <= 0) return true; // Dead

        // Collision logic only in 'fire' state
        if (this.state === 'fire') {
            if (paddle.x < this.x + this.w && paddle.x + paddle.w > this.x) {
                Game.takeDamage(0.3); // Rapid drain
            }
        }
        return false;
    }
    draw(ctx) {
        if (this.state === 'warn') {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.fillRect(this.x, 0, this.w, GAME_HEIGHT);
            ctx.font = '30px serif'; ctx.fillText("💀", this.x + 10, 40);
        } else if (this.state === 'charge') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(this.x + 25, 0, 10, GAME_HEIGHT);
        } else if (this.state === 'fire') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x, 0, this.w, GAME_HEIGHT);
        }
    }
}

class Particle {
    constructor(x, y, color) { this.x = x; this.y = y; this.vx = (Math.random()-0.5)*10; this.vy = (Math.random()-0.5)*10; this.life = 1; this.color = color; }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.05; return this.life <= 0; }
    draw(ctx) { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, 4, 4); ctx.globalAlpha = 1; }
}

// --- MAIN GAME ENGINE ---
const Game = {
    state: 'BOOT', // BOOT, MENU, PLAY, DIALOGUE, BOSS, CUTSCENE, ENDLESS, GAMEOVER
    maxHp: 20, hp: 20, score: 0, hiScore: localStorage.getItem('sansHiScore') || 0,
    timer: 120, shake: 0,
    
    // Entities
    paddle: null, balls: [], bricks: [], drops: [], blasters: [], particles: [], cutsceneActors: [],

    init() {
        // Boot screen click logic
        document.getElementById('boot-screen').addEventListener('click', () => {
            AudioSys.init();
            document.getElementById('boot-screen').classList.remove('active');
            document.getElementById('menu-screen').classList.add('active');
            AudioSys.playMusic('menu');
            this.state = 'MENU';
        });

        // UI Listeners
        document.getElementById('btn-pc').onclick = () => this.startGame('pc');
        document.getElementById('btn-mobile').onclick = () => this.startGame('mobile');
        document.getElementById('vol-music').oninput = () => AudioSys.updateVolumes();
        document.getElementById('vol-sfx').oninput = () => AudioSys.updateVolumes();
        document.getElementById('btn-kill').onclick = () => this.triggerCutscene();
        document.getElementById('btn-spare').onclick = () => this.triggerSpare();

        requestAnimationFrame(t => this.loop(t));
    },

    startGame(platform) {
        Input.init(platform);
        AudioSys.playSFX('start'); // Plays your battle-start.mp3
        
        setTimeout(() => {
            document.getElementById('menu-screen').classList.remove('active');
            document.getElementById('hud').classList.remove('hidden');
            if (platform === 'mobile') document.getElementById('mobile-controls').classList.remove('hidden');

            this.hp = this.maxHp; this.score = 0; this.updateUI();
            this.paddle = new Paddle();
            this.balls = [new Ball(GAME_WIDTH/2, GAME_HEIGHT/2, 4, -4)];
            this.generateBricks();
            
            this.state = 'PLAY';
            AudioSys.playMusic('battle');
        }, 500); // Slight delay for the start sound to breathe
    },

    generateBricks() {
        this.bricks = [];
        const cols = 7, rows = 5, padding = 10, offsetTop = 60, offsetLeft = 15;
        for(let r=0; r<rows; r++) {
            for(let c=0; c<cols; c++) {
                this.bricks.push(new Brick(offsetLeft + c*(60+padding), offsetTop + r*(20+padding)));
            }
        }
    },

    takeDamage(amt) {
        this.hp -= amt;
        this.shake = 10;
        if(this.hp <= 0) {
            this.hp = 0;
            this.updateUI();
            this.state = 'GAMEOVER';
            AudioSys.stopAllMusic();
            AudioSys.playSFX('lose'); // Plays your lose.ogg
            
            setTimeout(() => {
                alert("STAY DETERMINED!");
                location.reload();
            }, 1000);
        }
        this.updateUI();
    },

    spawnDropsAndParticles(x, y) {
        // Particles
        for(let i=0; i<10; i++) this.particles.push(new Particle(x+30, y+10, '#fff'));
        // Drop chance
        if (Math.random() < 0.25) {
            const types = ['S', '🍄', '⭐', '💣'];
            this.drops.push(new Drop(x+30, y+10, types[Math.floor(Math.random()*types.length)]));
        }
    },

    applyPowerup(type) {
        if(type === 'S') this.balls.forEach(b => { b.dx *= 0.7; b.dy *= 0.7; });
        if(type === '🍄') { this.paddle.w = 140; setTimeout(()=> {if(this.paddle) this.paddle.w = 80;}, 8000); }
        if(type === '⭐') this.balls.push(new Ball(this.paddle.x + this.paddle.w/2, this.paddle.y - 10, (Math.random()-0.5)*6, -4));
        if(type === '💣') this.takeDamage(3);
    },

    startDialogue() {
        this.state = 'DIALOGUE';
        AudioSys.stopAllMusic();
        this.balls = []; this.drops = [];
        
        const lines = [
            { n: "BOMB", f: "💣", t: "WOW. YOU BROKE ALL MY BLOCKS." },
            { n: "BOMB", f: "💣", t: "BUT LOOK WHO JUST WOKE UP..." },
            { n: "SANS", f: "💀", t: "* heya. you've been busy." },
            { n: "SANS", f: "💀", t: "* let's see if you can survive this." }
        ];

        document.getElementById('dialogue-box').classList.remove('hidden');
        let lineIdx = 0;

        const typeNextLine = () => {
            if (lineIdx >= lines.length) {
                document.getElementById('dialogue-box').classList.add('hidden');
                this.startBossPhase();
                return;
            }
            document.getElementById('speaker-name').innerText = lines[lineIdx].n;
            document.getElementById('portrait').innerText = lines[lineIdx].f;
            let el = document.getElementById('dialogue-text');
            el.innerText = "";
            let text = lines[lineIdx].t;
            let charIdx = 0;

            let interval = setInterval(() => {
                el.innerText += text[charIdx];
                AudioSys.playSFX('talk');
                charIdx++;
                if (charIdx >= text.length) {
                    clearInterval(interval);
                    lineIdx++;
                    setTimeout(typeNextLine, 1500);
                }
            }, 50);
        };
        typeNextLine();
    },

    startBossPhase() {
        this.state = 'BOSS';
        this.timer = 120;
        this.paddle.color = '#ff0000'; // Soul color
        this.balls = [new Ball(GAME_WIDTH/2, GAME_HEIGHT/2, 5, -5)];
        document.getElementById('ui-timer').classList.remove('hidden');
        AudioSys.playMusic('boss');
    },

    triggerChoice() {
        this.state = 'PAUSED';
        AudioSys.stopAllMusic();
        document.getElementById('choice-screen').classList.remove('hidden');
        document.getElementById('choice-screen').classList.add('active');
    },

    triggerSpare() {
        document.getElementById('choice-screen').classList.remove('active');
        alert("You spared him. Some say he is still sleeping.");
        location.reload();
    },

    triggerCutscene() {
        document.getElementById('choice-screen').classList.remove('active');
        this.state = 'CUTSCENE';
        this.blasters = []; this.balls = [];
        
        // Bomb walks in and throws rose
        let bombObj = { x: 0, y: GAME_HEIGHT/2, step: 0 };
        let roseObj = null;

        let cutsceneLoop = setInterval(() => {
            bombObj.step++;
            if(bombObj.step < 60) bombObj.x += 3;
            if(bombObj.step === 60) roseObj = { x: bombObj.x, y: bombObj.y, vy: -5 };
            if(bombObj.step > 60 && bombObj.step < 120) bombObj.x -= 3;
            if(roseObj) { roseObj.y += roseObj.vy; roseObj.vy += 0.2; }
            
            ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.font = '30px serif';
            ctx.fillText("💣", bombObj.x, bombObj.y);
            if(roseObj) ctx.fillText("🌹", roseObj.x, roseObj.y);

            if(bombObj.step === 150) {
                clearInterval(cutsceneLoop);
                this.startEndless();
            }
        }, 1000/60);
    },

    startEndless() {
        this.state = 'ENDLESS';
        this.paddle.color = '#fff';
        document.getElementById('ui-timer').classList.add('hidden');
        AudioSys.playMusic('battle');
        this.balls = [new Ball(GAME_WIDTH/2, GAME_HEIGHT/2, 5, -5)];
        this.generateBricks();
    },

    updateUI() {
        document.getElementById('ui-score').innerText = this.score;
        document.getElementById('ui-hiscore').innerText = this.hiScore;
        document.getElementById('ui-hp').innerText = `${Math.ceil(this.hp)}/${this.maxHp}`;
        document.getElementById('hp-bar-fill').style.width = `${(this.hp/this.maxHp)*100}%`;
        if(this.score > this.hiScore) {
            this.hiScore = this.score;
            localStorage.setItem('sansHiScore', this.hiScore);
        }
    },

    // --- GAME LOOP UPDATE & DRAW ---
    loop(timestamp) {
        requestAnimationFrame(t => this.loop(t));

        if(this.state === 'BOOT' || this.state === 'MENU' || this.state === 'PAUSED' || this.state === 'CUTSCENE') return;

        // Screen Shake Logic
        ctx.save();
        if(this.shake > 0) {
            const dx = (Math.random()-0.5)*10; const dy = (Math.random()-0.5)*10;
            ctx.translate(dx, dy);
            this.shake--;
        }

        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        if(this.paddle) {
            this.paddle.update();
            this.paddle.draw(ctx);
        }

        // Balls Updates
        for(let i = this.balls.length - 1; i >= 0; i--) {
            let b = this.balls[i];
            b.update(this.paddle);
            b.draw(ctx);
            
            // Brick Collision
            if(this.state === 'PLAY' || this.state === 'ENDLESS') {
                for(let br of this.bricks) {
                    if(br.active && b.x > br.x && b.x < br.x+br.w && b.y > br.y && b.y < br.y+br.h) {
                        br.active = false; b.dy *= -1; this.score += 10; this.updateUI();
                        this.spawnDropsAndParticles(br.x, br.y);
                    }
                }
            }
            
            // Fall off screen
            if(b.y > GAME_HEIGHT) {
                this.balls.splice(i, 1);
                if(this.balls.length === 0) {
                    this.takeDamage(2);
                    if(this.hp > 0) this.balls.push(new Ball(GAME_WIDTH/2, GAME_HEIGHT/2, 4, -4));
                }
            }
        }

        // Drops Update
        for(let i = this.drops.length - 1; i >= 0; i--) {
            let d = this.drops[i]; d.update(); d.draw(ctx);
            if(d.y > this.paddle.y && d.x > this.paddle.x && d.x < this.paddle.x + this.paddle.w) {
                this.applyPowerup(d.type); this.drops.splice(i, 1);
            } else if(d.y > GAME_HEIGHT) this.drops.splice(i, 1);
        }

        // Particles Update
        for(let i = this.particles.length - 1; i >= 0; i--) {
            if(this.particles[i].update()) this.particles.splice(i, 1);
            else this.particles[i].draw(ctx);
        }

        // Render Bricks
        if(this.state === 'PLAY' || this.state === 'ENDLESS') {
            this.bricks.forEach(br => br.draw(ctx));
            
            // Phase Checks
            if(this.state === 'PLAY' && this.bricks.every(b => !b.active)) this.startDialogue();
            if(this.state === 'ENDLESS' && this.bricks.every(b => !b.active)) this.generateBricks();
        }

        // Boss Logic
        if(this.state === 'BOSS') {
            this.timer -= 1/60;
            let mins = Math.floor(Math.max(0, this.timer) / 60);
            let secs = Math.floor(Math.max(0, this.timer) % 60);
            document.getElementById('ui-timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if(Math.random() < 0.03) this.blasters.push(new Blaster());

            for(let i = this.blasters.length - 1; i >= 0; i--) {
                if(this.blasters[i].update(this.paddle)) this.blasters.splice(i, 1);
                else this.blasters[i].draw(ctx);
            }

            if(this.timer <= 0) this.triggerChoice();
        }

        ctx.restore();
    }
};

// Start Boot
window.onload = () => Game.init();