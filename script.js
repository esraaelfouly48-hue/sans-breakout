const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 400; canvas.height = 500;

const Game = {
    state: 'MENU', hp: 20, score: 0, platform: 'pc',
    paddle: { x: 160, y: 470, w: 80, h: 12, targetX: 160 },
    balls: [], bricks: [], blasters: [], drops: [], particles: [],
    timer: 120,

    audio: {
        menu: new Audio('menu.ogg'),
        battle: new Audio('battle.ogg'), // Fixed from battle.ogg
        mega: new Audio('Megalovania.mp3'), // Fixed Capital M
        talk: new Audio('just-sans-talking.mp3'),
        blast: new Audio('gaster_blaster.mp3'),
        start: new Audio('battle-start.mp3') // Fixed Hyphen
    },

    start(mode) {
        this.platform = mode;
        this.unlockAudio();
        
        document.getElementById('menu').classList.add('hidden');
        if(mode === 'mobile') document.getElementById('mobile-ctrl').classList.remove('hidden');
        
        this.state = 'ROUND1';
        this.audio.menu.pause();
        this.audio.battle.loop = true;
        this.audio.battle.play().catch(e => console.log("Audio blocked: interact with page"));
        
        this.initBricks();
        this.balls = [{ x: 200, y: 300, dx: 3, dy: -3 }];
        this.gameLoop();
    },

    unlockAudio() {
        // Prime all audio files so they can play later
        Object.values(this.audio).forEach(sound => {
            sound.play().then(() => { sound.pause(); sound.currentTime = 0; }).catch(() => {});
        });
    },

    initBricks() {
        this.bricks = [];
        for(let r=0; r<4; r++) {
            for(let c=0; c<6; c++) this.bricks.push({ x: c*64+10, y: r*25+50, w: 60, h: 20, active: true });
        }
    },

    gameLoop() {
        ctx.clearRect(0, 0, 400, 500);
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    },

    update() {
        if(this.state === 'PAUSED') return;

        // Smooth Paddle
        this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.15;

        // Ball logic
        this.balls.forEach((b, i) => {
            b.x += b.dx; b.y += b.dy;
            if(b.x < 0 || b.x > 400) b.dx *= -1;
            if(b.y < 0) b.dy *= -1;
            if(b.y > this.paddle.y && b.y < this.paddle.y + this.paddle.h && 
               b.x > this.paddle.x && b.x < this.paddle.x + this.paddle.w) {
                b.dy = -Math.abs(b.dy);
            }
            if(this.state !== 'BOSS') {
                this.bricks.forEach(br => {
                    if(br.active && b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h) {
                        br.active = false; b.dy *= -1; this.score += 10;
                        if(Math.random() < 0.2) this.spawnDrop(br.x, br.y);
                    }
                });
            }
            if(b.y > 500) {
                this.balls.splice(i, 1);
                if(this.balls.length === 0) { this.hp -= 2; this.balls.push({x:200,y:300,dx:3,dy:-3}); }
            }
        });

        // Drop logic
        this.drops.forEach((d, i) => {
            d.y += 2;
            if(d.y > this.paddle.y && d.x > this.paddle.x && d.x < this.paddle.x + this.paddle.w) {
                this.applyPower(d.type); this.drops.splice(i, 1);
            }
        });

        // State changes
        if(this.state === 'ROUND1' && this.bricks.every(b => !b.active)) this.startDialogue();
        
        if(this.state === 'BOSS') {
            this.timer -= 1/60;
            document.getElementById('timer').innerText = Math.ceil(this.timer);
            if(Math.random() < 0.02) this.spawnBlaster();
            if(this.timer <= 0) this.showChoices();
        }

        this.blasters.forEach((bl, i) => {
            bl.t--;
            if(bl.t === 40) this.audio.blast.play();
            if(bl.t < 40 && bl.t > 0 && this.paddle.x < bl.x + 30 && this.paddle.x + this.paddle.w > bl.x) this.hp -= 0.15;
            if(bl.t <= 0) this.blasters.splice(i, 1);
        });

        document.getElementById('score').innerText = this.score;
        if(this.hp <= 0) { alert("Determination Lost."); location.reload(); }
    },

    draw() {
        // Soul (Paddle)
        ctx.fillStyle = (this.state === 'BOSS') ? '#ff0000' : '#fff';
        ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
        
        // Game elements
        this.bricks.forEach(b => { if(b.active) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, b.w, b.h); } });
        ctx.fillStyle = '#fff';
        this.balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI*2); ctx.fill(); });
        this.drops.forEach(d => ctx.fillText(d.type, d.x, d.y));
        
        // Blasters
        this.blasters.forEach(bl => {
            if(bl.t > 40) {
                ctx.globalAlpha = 0.2; ctx.fillStyle = 'red'; ctx.fillRect(bl.x, 0, 30, 500); ctx.globalAlpha = 1;
                ctx.fillText("💀", bl.x + 5, 30);
            } else {
                ctx.fillStyle = 'white'; ctx.fillRect(bl.x, 0, 30, 500);
            }
        });
    },

    spawnDrop(x, y) { this.drops.push({ x, y, type: ['S', '🍄', '⭐', '💣'][Math.floor(Math.random()*4)] }); },
    spawnBlaster() { this.blasters.push({ x: Math.random() * 370, t: 100 }); },
    applyPower(type) {
        if(type === 'S') this.balls.forEach(b => {b.dx*=0.7; b.dy*=0.7});
        if(type === '🍄') this.paddle.w = 120;
        if(type === '⭐') this.balls.push({x:200,y:300,dx:-3,dy:-3});
        if(type === '💣') this.hp -= 4;
    },

    startDialogue() {
        this.state = 'PAUSED'; this.audio.battle.pause();
        this.showLines([
            { n: "BOMB", f: "💣", t: "Wait... you actually won?" },
            { n: "SANS", f: "💀", t: "* heh. kids today have no chill." }
        ], () => {
            this.audio.mega.play(); this.state = 'BOSS'; 
            document.getElementById('timer').classList.remove('hidden');
        });
    },

    showLines(lines, cb) {
        const ui = document.getElementById('dialogue-ui'); ui.classList.remove('hidden');
        let i = 0;
        const next = () => {
            if(i >= lines.length) { ui.classList.add('hidden'); cb(); return; }
            document.getElementById('name').innerText = lines[i].n;
            document.getElementById('portrait').innerText = lines[i].f;
            let el = document.getElementById('text'), cur = 0, txt = lines[i].t;
            el.innerText = "";
            let itv = setInterval(() => {
                el.innerText += txt[cur]; this.audio.talk.currentTime = 0; this.audio.talk.play();
                cur++; if(cur >= txt.length) { clearInterval(itv); i++; setTimeout(next, 1500); }
            }, 50);
        };
        next();
    },

    showChoices() { this.state = 'PAUSED'; this.audio.mega.pause(); document.getElementById('choice-ui').classList.remove('hidden'); },
    resolve(c) {
        document.getElementById('choice-ui').classList.add('hidden');
        if(c === 'kill') { 
            this.state = 'ENDLESS'; this.audio.battle.play(); this.initBricks(); 
        } else { location.reload(); }
    }
};

// Controls
window.addEventListener('mousemove', (e) => {
    if(Game.platform !== 'pc') return;
    const rect = canvas.getBoundingClientRect();
    Game.paddle.targetX = Math.max(0, Math.min(400 - Game.paddle.w, (e.clientX - rect.left) - Game.paddle.w/2));
});

document.getElementById('mobile-ctrl').addEventListener('touchmove', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let pct = Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
    document.getElementById('touch-handle').style.left = pct + '%';
    Game.paddle.targetX = (pct / 100) * (400 - Game.paddle.w);
});