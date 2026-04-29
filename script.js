/**
 * THE DETERMINATION ENGINE
 * Handles multi-phase game states, mobile touch-sliding, and telegraphed boss attacks.
 */

const Engine = {
    canvas: document.getElementById('gameCanvas'),
    ctx: null,
    state: 'MENU',
    platform: 'pc',
    score: 0,
    hiScore: localStorage.getItem('hiScore') || 0,
    hp: 20,
    
    // Core Objects
    paddle: { x: 160, y: 550, w: 80, h: 12, targetX: 160 },
    balls: [],
    bricks: [],
    blasters: [],
    drops: [],
    particles: [], // For the rose and death effects
    
    // Assets
    sounds: {
        menu: new Audio('menu.ogg'),
        ghost: new Audio('ghost_song.mp3'),
        mega: new Audio('megalovania.mp3'),
        talk: new Audio('just-sans-talking.mp3'),
        blast: new Audio('gaster_blaster.mp3')
    },
    images: {
        head: new Image(),
        open: new Image()
    },

    init(mode) {
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 400;
        this.canvas.height = 600;
        this.platform = mode;

        // Load Images
        this.images.head.src = 'image_7c22d9.png';
        this.images.open.src = 'image_7c1f54.png';

        // Unlock & Sync Audio
        this.syncVolume();
        Object.values(this.sounds).forEach(s => { s.play(); s.pause(); s.currentTime = 0; });

        document.getElementById('menu').classList.add('hidden');
        if(mode === 'mobile') document.getElementById('mobile-ctrl').classList.remove('hidden');

        this.startRound1();
        requestAnimationFrame((t) => this.loop(t));
    },

    syncVolume() {
        const mVol = document.getElementById('musicVol').value;
        const sVol = document.getElementById('sfxVol').value;
        this.sounds.menu.volume = mVol;
        this.sounds.ghost.volume = mVol;
        this.sounds.mega.volume = mVol;
        this.sounds.talk.volume = sVol;
        this.sounds.blast.volume = sVol;
    },

    startRound1() {
        this.state = 'ROUND1';
        this.sounds.menu.pause();
        this.sounds.ghost.loop = true;
        this.sounds.ghost.play();
        this.balls = [{ x: 200, y: 400, dx: 3, dy: -3 }];
        this.createBricks();
    },

    createBricks() {
        this.bricks = [];
        for(let r=0; r<4; r++) {
            for(let c=0; c<6; c++) {
                this.bricks.push({ x: c*64 + 10, y: r*25 + 60, w: 60, h: 20, active: true });
            }
        }
    },

    // --- MAIN GAME LOOP ---
    loop(t) {
        this.ctx.clearRect(0,0,400,600);
        this.update();
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    },

    update() {
        if(this.state === 'PAUSED' || this.state === 'MENU') return;

        // Smooth Paddle Follow
        this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.15;

        // Ball & Brick Collision
        this.balls.forEach((b, i) => {
            b.x += b.dx; b.y += b.dy;
            if(b.x < 0 || b.x > 400) b.dx *= -1;
            if(b.y < 0) b.dy *= -1;
            
            // Paddle Bounce
            if(b.y > this.paddle.y && b.y < this.paddle.y + this.paddle.h && 
               b.x > this.paddle.x && b.x < this.paddle.x + this.paddle.w) {
                b.dy = -Math.abs(b.dy);
                b.dx += (b.x - (this.paddle.x + this.paddle.w/2)) * 0.1; // Add English
            }

            // Bricks (Round 1 / Endless)
            if(this.state === 'ROUND1' || this.state === 'ENDLESS') {
                this.bricks.forEach(br => {
                    if(br.active && b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h) {
                        br.active = false; b.dy *= -1; this.score += 10;
                        if(Math.random() < 0.25) this.spawnDrop(br.x, br.y);
                    }
                });
            }

            if(b.y > 600) {
                this.balls.splice(i, 1);
                if(this.balls.length === 0) { this.takeDamage(2); this.balls.push({x:200, y:300, dx:3, dy:-3}); }
            }
        });

        // Drop Logic
        this.drops.forEach((d, i) => {
            d.y += 3;
            if(d.y > this.paddle.y && d.x > this.paddle.x && d.x < this.paddle.x + this.paddle.w) {
                this.applyPower(d.type);
                this.drops.splice(i, 1);
            }
        });

        // Boss Phase (Megalovania)
        if(this.state === 'BOSS') {
            this.bossTimer -= 1/60;
            document.getElementById('timer').innerText = Math.ceil(this.bossTimer);
            if(Math.random() < 0.02) this.spawnBlaster();
            if(this.bossTimer <= 0) this.triggerFinalChoice();
        }

        // Blaster Cycle: TELEGRAPH -> CHARGE -> FIRE
        this.blasters.forEach((bl, i) => {
            bl.timer--;
            if(bl.timer === 40) this.sounds.blast.play();
            if(bl.timer < 40 && bl.timer > 0) {
                // Hit Detection
                if(this.paddle.x < bl.x + 30 && this.paddle.x + this.paddle.w > bl.x) this.takeDamage(0.1);
            }
            if(bl.timer <= 0) this.blasters.splice(i, 1);
        });

        // Particle logic (Rose)
        this.particles.forEach((p, i) => {
            p.y += p.vy; p.vy += 0.1;
            if(p.y > 600) this.particles.splice(i, 1);
        });

        if(this.state === 'ROUND1' && this.bricks.every(b => !b.active)) this.goToDialogue();

        this.updateHUD();
    },

    draw() {
        const ctx = this.ctx;
        
        // Bricks
        this.bricks.forEach(b => { if(b.active) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, b.w, b.h); } });

        // Paddle (The Soul)
        ctx.fillStyle = (this.state === 'BOSS') ? '#ff0000' : '#fff';
        ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

        // Balls
        ctx.fillStyle = '#fff';
        this.balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI*2); ctx.fill(); });

        // Drops
        this.drops.forEach(d => { ctx.font = '20px serif'; ctx.fillText(d.type, d.x, d.y); });

        // Blasters
        this.blasters.forEach(bl => {
            if(bl.timer > 40) {
                // Telegraphing Phase
                ctx.globalAlpha = 0.3; ctx.fillStyle = 'red'; ctx.fillRect(bl.x, 0, 30, 600); ctx.globalAlpha = 1;
                ctx.drawImage(this.images.head, bl.x - 10, 40, 50, 50);
            } else {
                // Firing Phase
                ctx.fillStyle = '#fff'; ctx.fillRect(bl.x, 0, 30, 600);
                ctx.drawImage(this.images.open, bl.x - 15, 30, 60, 60);
            }
        });

        // Particles (Rose)
        this.particles.forEach(p => { ctx.font = '16px serif'; ctx.fillText(p.char, p.x, p.y); });
    },

    spawnDrop(x, y) { this.drops.push({ x, y, type: ['S', '🍄', '⭐', '💣'][Math.floor(Math.random()*4)] }); },
    spawnBlaster() { this.blasters.push({ x: Math.random() * 370, timer: 120 }); },

    applyPower(type) {
        if(type === 'S') this.balls.forEach(b => { b.dx *= 0.6; b.dy *= 0.6; });
        if(type === '🍄') { this.paddle.w = 120; setTimeout(()=>this.paddle.w=80, 5000); }
        if(type === '⭐') this.balls.push({ x: 200, y: 300, dx: -3, dy: -3 });
        if(type === '💣') this.takeDamage(4);
    },

    takeDamage(v) {
        this.hp -= v;
        if(this.hp <= 0) { alert("STAY DETERMINED!"); location.reload(); }
    },

    goToDialogue() {
        this.state = 'PAUSED';
        this.sounds.ghost.pause();
        this.balls = [];
        this.showDialogue([
            { s: "BOMB", p: "💣", t: "Hey! You broke all the bricks." },
            { s: "BOMB", p: "💣", t: "But look who just showed up..." },
            { s: "SANS", p: "💀", t: "* heh. you've been busy, huh?" },
            { s: "SANS", p: "💀", t: "* let's see how long you last." }
        ], () => this.startBoss());
    },

    showDialogue(lines, callback) {
        const ui = document.getElementById('dialogue-ui');
        const msg = document.getElementById('message');
        const port = document.getElementById('portrait');
        const spk = document.getElementById('speaker');
        document.getElementById('dialogue-box').classList.remove('hidden');

        let i = 0;
        const typeNext = () => {
            if(i >= lines.length) { document.getElementById('dialogue-box').classList.add('hidden'); callback(); return; }
            spk.innerText = lines[i].s;
            port.innerText = lines[i].p;
            msg.innerText = "";
            let char = 0;
            let timer = setInterval(() => {
                msg.innerText += lines[i].t[char];
                this.sounds.talk.currentTime = 0; this.sounds.talk.play();
                char++;
                if(char >= lines[i].t.length) {
                    clearInterval(timer); i++; setTimeout(typeNext, 1200);
                }
            }, 50);
        };
        typeNext();
    },

    startBoss() {
        this.state = 'BOSS';
        this.bossTimer = 120;
        this.balls = [{ x: 200, y: 300, dx: 4, dy: -4 }];
        document.getElementById('timer').classList.remove('hidden');
        this.sounds.mega.play();
    },

    triggerFinalChoice() {
        this.state = 'PAUSED';
        this.sounds.mega.pause();
        document.getElementById('choice-ui').classList.remove('hidden');
    },

    resolveChoice(type) {
        document.getElementById('choice-ui').classList.add('hidden');
        if(type === 'kill') {
            // Tiny rose animation
            this.particles.push({ x: 200, y: 150, vy: -3, char: '🌹' });
            setTimeout(() => {
                this.state = 'ENDLESS';
                this.sounds.ghost.play();
                this.createBricks();
            }, 2000);
        } else {
            alert("SANS SPARED. GAME OVER.");
            location.reload();
        }
    },

    updateHUD() {
        document.getElementById('score').innerText = this.score;
        document.getElementById('hi-score').innerText = this.hiScore;
    }
};

// --- INPUTS ---
window.addEventListener('mousemove', (e) => {
    if(Engine.platform === 'pc') {
        const rect = Engine.canvas.getBoundingClientRect();
        Engine.paddle.targetX = e.clientX - rect.left - Engine.paddle.w/2;
    }
});

const handle = document.getElementById('handle');
document.getElementById('mobile-ctrl').addEventListener('touchmove', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = e.touches[0].clientX - rect.left;
    let pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    handle.style.left = pct + '%';
    Engine.paddle.targetX = (pct/100) * (400 - Engine.paddle.w);
});

// Update volumes on the fly
document.getElementById('musicVol').oninput = () => Engine.syncVolume();
document.getElementById('sfxVol').oninput = () => Engine.syncVolume();