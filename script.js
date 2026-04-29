const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- AUDIO OBJECTS ---
const music = {
    menu: new Audio('menu.ogg'),
    battle: new Audio('Megalovania.mp3'),
    talking: new Audio('just-sans-talking.mp3'),
    start: new Audio('battle-start.mp3'),
    blaster: new Audio('gaster_blaster.mp3')
};
music.menu.loop = true;
music.battle.loop = true;

// --- GAME STATE ---
let state = "MENU"; // MENU, DIALOGUE, BATTLE
let hp = 20, score = 0, frameCount = 0;
let player = { x: 160, y: 470, width: 80, height: 10, speed: 7 };
let balls = [], drops = [], bricks = [], blasters = [];

const dialogueSeq = [
    { name: "BOMB", p: "💣", t: "hey dude... wont u get damages or sth?" },
    { name: "BOMB", p: "💣", t: "i'm worried about u." },
    { name: "SANS", p: "💀", t: "* heh. don't sweat it, buddy." },
    { name: "SANS", p: "💀", t: "* i'll take it from here." },
    { name: "SANS", p: "💀", t: "* ready for a bad time?" }
];
let diagIdx = 0;

// --- CONTROLS ---
const keys = { left: false, right: false };
const setupBtn = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
    el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
};
setupBtn('btnLeft', 'left'); setupBtn('btnRight', 'right');

// --- CORE FUNCTIONS ---
function initGame() {
    music.menu.play();
    document.getElementById('startScreen').classList.add('hidden');
    startDialogue();
}

function startDialogue() {
    state = "DIALOGUE";
    document.getElementById('dialogueBox').classList.remove('hidden');
    updateDialogue();
}

function updateDialogue() {
    const d = dialogueSeq[diagIdx];
    document.getElementById('speakerName').innerText = d.name;
    document.getElementById('portrait').innerText = d.p;
    document.getElementById('dialogueText').innerText = d.t;
    music.talking.currentTime = 0;
    music.talking.play();
}

document.getElementById('dialogueBox').addEventListener('click', () => {
    diagIdx++;
    if (diagIdx < dialogueSeq.length) {
        updateDialogue();
    } else {
        beginBattle();
    }
});

function beginBattle() {
    document.getElementById('dialogueBox').classList.add('hidden');
    document.getElementById('mobileControls').classList.remove('hidden');
    music.menu.pause();
    music.start.play();
    
    setTimeout(() => {
        music.battle.play();
        state = "BATTLE";
        player.width = 40; // Smaller paddle for boss fight
        balls.push({ x: 200, y: 300, dx: 4, dy: -4 });
        requestAnimationFrame(gameLoop);
    }, 1500);
}

function spawnDrop(x, y) {
    const types = ['S', '💧', '❄️'];
    drops.push({ x, y, type: types[Math.floor(Math.random()*types.length)] });
}

function gameLoop() {
    if (state !== "BATTLE") return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Paddle Movement
    if (keys.left && player.x > 0) player.x -= player.speed;
    if (keys.right && player.x < canvas.width - player.width) player.x += player.speed;

    // Draw Paddle
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 15; ctx.shadowColor = "#008cff";
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;

    // Gaster Blaster Logic
    if (frameCount % 120 === 0) {
        let bx = Math.random() * (canvas.width - 50);
        blasters.push({ x: bx, timer: 60 });
        music.blaster.play();
    }

    blasters.forEach((b, i) => {
        b.timer--;
        if (b.timer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${b.timer/60})`;
            ctx.fillRect(b.x, 0, 50, canvas.height);
            ctx.font = "30px Arial";
            ctx.fillText("💀", b.x + 10, 40);
            
            // Beam Collision
            if (player.x < b.x + 50 && player.x + player.width > b.x) {
                hp -= 0.05;
            }
        } else { blasters.splice(i, 1); }
    });

    // Ball Logic
    balls.forEach((ball, i) => {
        ball.x += ball.dx; ball.y += ball.dy;
        if (ball.x < 0 || ball.x > canvas.width) ball.dx *= -1;
        if (ball.y < 0) ball.dy *= -1;
        if (ball.y > player.y && ball.x > player.x && ball.x < player.x + player.width) {
            ball.dy = -Math.abs(ball.dy);
            score += 10;
            if(Math.random() < 0.3) spawnDrop(ball.x, ball.y);
        }
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(ball.x, ball.y, 6, 0, Math.PI*2); ctx.fill();
    });

    // Drops Logic
    drops.forEach((d, i) => {
        d.y += 3;
        ctx.font = "16px Arial"; // Shrunk size
        ctx.fillText(d.type, d.x, d.y);
        if (d.y > player.y && d.x > player.x && d.x < player.x + player.width) {
            if (d.type === 'S') hp = Math.min(20, hp + 2);
            drops.splice(i, 1);
        }
    });

    document.getElementById('hp').innerText = Math.ceil(hp);
    document.getElementById('score').innerText = score;

    if (hp <= 0) {
        alert("GAME OVER. STAY DETERMINED.");
        location.reload();
        return;
    }

    frameCount++;
    requestAnimationFrame(gameLoop);
}