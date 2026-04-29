/**
 * DETERMINATION BREAKOUT
 * A high-efficiency, flexible game engine for Undertale fans.
 */

const Game = {
    canvas: document.getElementById('gameCanvas'),
    ctx: null,
    state: 'MENU',
    platform: 'pc',
    hp: 20,
    score: 0,
    hiScore: localStorage.getItem('ut_hi_score') || 0,
    round: 1,
    shake: 0,
    
    // Entity Collections
    paddle: { x: 160, y: 550, w: 80, h: 12, targetX: 160 },
    balls: [],
    bricks: [],
    drops: [],
    blasters: [],
    
    // Timing
    bossTimer: 120, // 2 Minutes
    lastTime: 0,

    init(mode) {
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 400;
        this.canvas.height = 550;
        this.platform = mode;
        this.hiScore = localStorage.getItem('ut_hi_score') || 0;
        document.getElementById('hi-score').innerText = this.hiScore;
        
        document.getElementById('main-menu').classList.add('hidden');
        if(mode === 'mobile') document.getElementById('touch-zone').classList.remove('hidden');

        AudioController.stop('menu');
        AudioController.play('ghost', true);
        
        this.startRound1();
        requestAnimationFrame((t) => this.loop(t));
    },

    startRound1() {
        this.state = 'ROUND1';
        this.hp = 20;
        this.score = 0;
        this.round = 1;
        this.balls = [{ x: 200, y: 400, dx: 3, dy: -3, r: 6 }];
        this.createBricks();
    },

    createBricks() {
        this.bricks = [];
        for(let r=0; r<4; r++) {
            for(let c=0; c<6; c++) {
                this.bricks.push({
                    x: c * 62 + 15,
                    y: r * 25 + 60,
                    w: 55,
                    h: 15,
                    hp: 1
                });
            }
        }
    },

    // --- MAIN LOOP ---
    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        if (this.state !== 'GAMEOVER') {
            requestAnimationFrame((t) => this.loop(t));
        }
    },

    update(dt) {
        if (this.state === 'PAUSED') return;

        // Paddle Smooth Follow
        this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.2;

        // Ball Logic
        this.balls.forEach((ball, index) => {
            ball.x += ball.dx;
            ball.y += ball.dy;

            // Wall Collisions
            if(ball.x <= 0 || ball.x >= this.canvas.width) ball.dx *= -1;
            if(ball.y <= 0) ball.dy *= -1;
            
            // Paddle Collision
            if(ball.y >= this.paddle.y && ball.y <= this.paddle.y + this.paddle.h &&
               ball.x >= this.paddle.x && ball.x <= this.paddle.x + this.paddle.w) {
                ball.dy = -Math.abs(ball.dy);
                // Angular bounce
                let diff = ball.x - (this.paddle.x + this.paddle.w/2);
                ball.dx = diff * 0.15;
            }

            // Brick Collision (Round 1/Endless)
            if(this.state === 'ROUND1' || this.state === 'ENDLESS') {
                this.bricks.forEach(brick => {
                    if(brick.hp > 0 && ball.x > brick.x && ball.x < brick.x + brick.w &&
                       ball.y > brick.y && ball.y < brick.y + brick.h) {
                        brick.hp--;
                        ball.dy *= -1;
                        this.score += 10;
                        if(Math.random() < 0.2) this.spawnDrop(brick.x, brick.y);
                    }
                });
            }

            // Out of bounds
            if(ball.y > this.canvas.height) {
                this.balls.splice(index, 1);
                if(this.balls.length === 0) {
                    this.takeDamage(2);
                    this.balls.push({ x: 200, y: 300, dx: 3, dy: -3, r: 6 });
                }
            }
        });

        // Drop Logic
        this.drops.forEach((drop, i) => {
            drop.y += 2;
            if(drop.y > this.paddle.y && drop.y < this.paddle.y + this.paddle.h &&
               drop.x > this.paddle.x && drop.x < this.paddle.x + this.paddle.w) {
                this.applyPowerUp(drop.type);
                this.drops.splice(i, 1);
            }
        });

        // Boss Phase Logic
        if(this.state === 'BOSS') {
            this.bossTimer -= dt;
            document.getElementById('timer-display').innerText = this.formatTime(this.bossTimer);
            
            if(Math.random() < 0.02) this.spawnBlaster();
            
            if(this.bossTimer <= 0) {
                this.triggerChoice();
            }
        }

        // Blaster Cycle
        this.blasters.forEach((b, i) => {
            b.life -= dt;
            if(b.life <= 0) this.blasters.splice(i, 1);
            // Damage during beam phase
            if(b.life < 0.5) { // The last 0.5s is the blast
                if(b.vertical && Math.abs(this.paddle.x + this.paddle.w/2 - b.x) < 20) this.takeDamage(0.1);
                if(!b.vertical && Math.abs(this.paddle.y + this.paddle.h/2 - b.y) < 20) this.takeDamage(0.1);
            }
        });

        // Win Round 1
        if(this.state === 'ROUND1' && this.bricks.every(b => b.hp <= 0)) {
            this.triggerTransition();
        }

        if(this.shake > 0) this.shake *= 0.9;
        
        this.updateHUD();
    },

    draw() {
        const ctx = this.ctx;
        ctx.save();
        if(this.shake > 0) ctx.translate(Math.random()*this.shake, Math.random()*this.shake);

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Bricks
        this.bricks.forEach(b => {
            if(b.hp <= 0) return;
            ctx.fillStyle = this.state === 'ENDLESS' ? '#ff00ff' : varColor(b.y);
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

        // Paddle
        ctx.fillStyle = (this.state === 'BOSS') ? '#ff0000' : '#fff';
        ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

        // Balls
        ctx.fillStyle = '#fff';
        this.balls.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
            ctx.fill();
        });

        // Blasters
        this.blasters.forEach(b => {
            // Telegraph
            if(b.life > 0.5) {
                ctx.strokeStyle = `rgba(255, 0, 0, ${Math.sin(Date.now()*0.01)*0.5 + 0.5})`;
                b.vertical ? ctx.strokeRect(b.x-20, 0, 40, 600) : ctx.strokeRect(0, b.y-20, 400, 40);
                // Draw head
                ctx.drawImage(Images.blasterHead, b.x-25, b.y-25, 50, 50);
            } else {
                // Beam
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 20; ctx.shadowColor = '#fff';
                b.vertical ? ctx.fillRect(b.x-15, 0, 30, 600) : ctx.fillRect(0, b.y-15, 400, 30);
                ctx.shadowBlur = 0;
                ctx.drawImage(Images.blasterOpen, b.x-30, b.y-30, 60, 60);
            }
        });

        // Drops
        this.drops.forEach(d => {
            ctx.font = '16px monospace';
            ctx.fillText(d.type, d.x, d.y);
        });

        ctx.restore();
    },

    // --- SYSTEMS ---
    spawnDrop(x, y) {
        const types = ['S', '🍄', '⭐', '💣'];
        this.drops.push({ x, y, type: types[Math.floor(Math.random()*types.length)] });
    },

    applyPowerUp(type) {
        if(type === 'S') this.balls.forEach(b => { b.dx *= 0.5; b.dy *= 0.5 });
        if(type === '🍄') { this.paddle.w = 120; setTimeout(() => this.paddle.w = 80, 5000); }
        if(type === '⭐') this.balls.push({...this.balls[0], dx: -this.balls[0].dx});
        if(type === '💣') this.takeDamage(3);
    },

    takeDamage(amt) {
        this.hp -= amt;
        this.shake = 10;
        if(this.hp <= 0) {
            alert("STAY DETERMINED... Try again?");
            location.reload();
        }
    },

    triggerTransition() {
        this.state = 'PAUSED';
        AudioController.stop('ghost');
        this.showDialogue([
            { name: "BOMB", p: "💣", t: "Yo bro... you actually cleared them all?" },
            { name: "BOMB", p: "💣", t: "But look behind you. You're in trouble." },
            { name: "SANS", p: "💀", t: "* heh. looks like you've been busy." },
            { name: "SANS", p: "💀", t: "* ready for a bad time?" }
        ], () => this.startBossFight());
    },

    startBossFight() {
        this.state = 'BOSS';
        this.bossTimer = 120;
        document.getElementById('timer-display').classList.remove('hidden');
        AudioController.play('mega', true);
    },

    spawnBlaster() {
        const isVert = Math.random() > 0.5;
        this.blasters.push({
            x: isVert ? Math.random() * 360 + 20 : (Math.random() > 0.5 ? 40 : 360),
            y: isVert ? (Math.random() > 0.5 ? 40 : 510) : Math.random() * 500,
            vertical: isVert,
            life: 2.5 // 2s telegraph, 0.5s blast
        });
        AudioController.playSFX('blaster');
    },

    triggerChoice() {
        this.state = 'PAUSED';
        this.balls = [];
        this.blasters = [];
        AudioController.stop('mega');
        document.getElementById('choice-wrap').classList.remove('hidden');
    },

    resolveChoice(type) {
        document.getElementById('choice-wrap').classList.add('hidden');
        if(type === 'spare') {
            alert("YOU SPARED HIM. THE END.");
            location.reload();
        } else {
            // Kill Animation simulation
            this.showDialogue([{ name: "SANS", p: "💀", t: "* ... i'm goin' to grillby's." }], () => {
                this.score += 1000;
                this.startEndless();
            });
        }
    },

    startEndless() {
        this.state = 'ENDLESS';
        AudioController.play('ghost', true);
        this.createBricks();
    },

    showDialogue(content, callback) {
        const container = document.getElementById('dialogue-container');
        const textEl = document.getElementById('diag-text');
        const nameEl = document.getElementById('speaker-name');
        container.classList.remove('hidden');
        
        let idx = 0;
        const next = () => {
            if(idx >= content.length) {
                container.classList.add('hidden');
                callback();
                return;
            }
            const current = content[idx];
            nameEl.innerText = current.name;
            textEl.innerText = "";
            let charIdx = 0;
            
            const typer = setInterval(() => {
                textEl.innerText += current.t[charIdx];
                AudioController.playSFX('talk');
                charIdx++;
                if(charIdx >= current.t.length) {
                    clearInterval(typer);
                    idx++;
                    setTimeout(next, 1000);
                }
            }, 50);
        };
        next();
    },

    updateHUD() {
        document.getElementById('hp-val').innerText = Math.ceil(this.hp);
        document.getElementById('score').innerText = this.score;
        if(this.score > this.hiScore) {
            this.hiScore = this.score;
            localStorage.setItem('ut_hi_score', this.hiScore);
        }
    },

    formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    }
};

// --- AUDIO CONTROLLER ---
const AudioController = {
    sources: {
        menu: new Audio('menu.ogg'),
        ghost: new Audio('ghost_song.mp3'),
        mega: new Audio('megalovania.mp3'),
        talk: new Audio('just-sans-talking.mp3'),
        blaster: new Audio('gaster_blaster.mp3'),
        start: new Audio('battle_start.mp3')
    },
    
    play(key, loop=false) {
        const a = this.sources[key];
        a.loop = loop;
        a.volume = document.getElementById('music-vol').value;
        a.play().catch(() => {
            window.addEventListener('click', () => a.play(), {once: true});
        });
    },

    stop(key) {
        this.sources[key].pause();
        this.sources[key].currentTime = 0;
    },

    playSFX(key) {
        const a = this.sources[key].cloneNode();
        a.volume = document.getElementById('sfx-vol').value;
        a.play();
    }
};

const Images = {
    blasterHead: new Image(),
    blasterOpen: new Image()
};
Images.blasterHead.src = 'image_7c22d9.png';
Images.blasterOpen.src = 'image_7c1f54.png';

// --- INPUTS ---
window.addEventListener('mousemove', (e) => {
    if(Game.platform === 'pc') {
        const rect = Game.canvas.getBoundingClientRect();
        Game.paddle.targetX = e.clientX - rect.left - Game.paddle.w/2;
    }
});

document.getElementById('touch-zone').addEventListener('touchmove', (e) => {
    const rect = Game.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    Game.paddle.targetX = touch.clientX - rect.left - Game.paddle.w/2;
});

function varColor(y) {
    const colors = ['#ff4444', '#ff8844', '#ffff44', '#44ff44'];
    return colors[Math.floor(y/50) % colors.length];
}

// Volume sync
document.getElementById('music-vol').addEventListener('input', (e) => {
    Object.values(AudioController.sources).forEach(a => a.volume = e.target.value);
});

// Auto-play menu on interaction
window.addEventListener('mousedown', () => {
    if(Game.state === 'MENU') AudioController.play('menu', true);
}, {once: true});