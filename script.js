const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const hpEl = document.getElementById('hp');
const startScreen = document.getElementById('startScreen');
const mobileControls = document.getElementById('mobileControls');
const bossDialogue = document.getElementById('bossDialogue');
const dialogueText = document.getElementById('dialogueText');

// Setup Audio Objects
const menuMusic = new Audio('menu.ogg');
const battleMusic = new Audio('battle.ogg');
const loseSound = new Audio('lose.ogg');
menuMusic.loop = true;
battleMusic.loop = true;

let gameLoop, isPlaying = false, gameMode = 'breakout', score = 0, hp = 20, level = 1, frameCount = 0;
let player = { x: 160, y: 470, width: 80, height: 10, speed: 7, color: 'white' };
let ball = { x: 200, y: 450, dx: 4, dy: -4, radius: 6 };
let bricks = [], bones = [], drops = [];

const keys = { ArrowLeft: false, ArrowRight: false };
window.addEventListener('keydown', (e) => { if(keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.code)) keys[e.code] = false; });

const setupBtn = (btnId, key) => {
    const btn = document.getElementById(btnId);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
};
setupBtn('btnLeft', 'ArrowLeft');
setupBtn('btnRight', 'ArrowRight');

function initBricks() {
    bricks = [];
    for (let c = 0; c < 5; c++) {
        bricks[c] = [];
        for (let r = 0; r < 3; r++) bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
}

function startGame(mode) {
    // --- THE MUSIC FIX ---
    // We "play" everything for 1 millisecond then pause. 
    // This unlocks them for the rest of the session.
    [menuMusic, battleMusic, loseSound].forEach(track => {
        track.play().then(() => track.pause()).catch(e => console.log("Audio unlock failed"));
    });

    menuMusic.currentTime = 0;
    menuMusic.play();

    startScreen.classList.add('hidden');
    if (mode === 'mobile') mobileControls.classList.remove('hidden');
    
    // Reset Game
    score = 0; hp = 20; level = 1; gameMode = 'breakout';
    player.width = 80; player.color = 'white';
    drops = []; bones = [];
    initBricks();
    updateHUD();
    isPlaying = true;
    gameLoop = requestAnimationFrame(update);
}

function updateHUD() {
    scoreEl.innerText = score; levelEl.innerText = level; hpEl.innerText = hp;
}

function startBossFight() {
    gameMode = 'boss';
    menuMusic.pause();
    battleMusic.currentTime = 0;
    battleMusic.play();
    
    player.width = 20; player.height = 20; player.color = 'red';
    player.y = 450;
    isPlaying = false;
    bossDialogue.classList.remove('hidden');
    dialogueText.innerText = "you've had your fun...\nready for a bad time?";
    
    setTimeout(() => {
        bossDialogue.classList.add('hidden');
        isPlaying = true;
        gameLoop = requestAnimationFrame(update);
    }, 3000);
}

function update() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (keys.ArrowLeft && player.x > 0) player.x -= player.speed;
    if (keys.ArrowRight && player.x < canvas.width - player.width) player.x += player.speed;

    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    if (gameMode === 'breakout') {
        // Ball Physics
        ball.x += ball.dx; ball.y += ball.dy;
        if (ball.x < 0 || ball.x > canvas.width) ball.dx *= -1;
        if (ball.y < 0) ball.dy *= -1;
        if (ball.y > player.y && ball.x > player.x && ball.x < player.x + player.width) {
            ball.dy = -Math.abs(ball.dy); 
        }
        if (ball.y > canvas.height) { hp -= 2; updateHUD(); ball.y = 300; ball.dy = -4; }

        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2);
        ctx.fillStyle = 'white'; ctx.fill(); ctx.closePath();

        // Bricks
        let count = 0;
        for(let c=0; c<5; c++) {
            for(let r=0; r<3; r++) {
                let b = bricks[c][r];
                if(b.status === 1) {
                    count++;
                    b.x = c * 75 + 25; b.y = r * 35 + 50;
                    ctx.fillStyle = '#00aaff';
                    ctx.fillRect(b.x, b.y, 60, 20);
                    if(ball.x > b.x && ball.x < b.x+60 && ball.y > b.y && ball.y < b.y+20) {
                        b.status = 0; ball.dy *= -1; score += 10;
                        // 40% Chance for a drop
                        if(Math.random() < 0.4) drops.push({x: b.x + 25, y: b.y, w: 15, h: 15});
                    }
                }
            }
        }

        // Drops Logic
        for(let i = drops.length - 1; i >= 0; i--) {
            let d = drops[i];
            d.y += 3;
            ctx.fillStyle = '#00ff00'; // Green
            ctx.fillRect(d.x, d.y, d.w, d.h);
            
            // Collision with paddle
            if(d.y + d.h > player.y && d.x + d.w > player.x && d.x < player.x + player.width) {
                hp = Math.min(20, hp + 2);
                updateHUD();
                drops.splice(i, 1);
            } else if (d.y > canvas.height) {
                drops.splice(i, 1);
            }
        }

        if (count === 0) startBossFight();
    } else {
        // Boss Mode
        if (frameCount % 20 === 0) bones.push({x: Math.random()*380, y: -20, speed: 5});
        bones.forEach((b, i) => {
            b.y += b.speed;
            ctx.fillStyle = 'white';
            ctx.fillRect(b.x, b.y, 15, 40);
            if (player.x < b.x + 15 && player.x + 20 > b.x && player.y < b.y + 40 && player.y + 20 > b.y) {
                hp--; updateHUD(); bones.splice(i, 1);
            }
            if (b.y > canvas.height) { bones.splice(i, 1); score += 5; updateHUD(); }
        });
    }

    if (hp <= 0) {
        isPlaying = false;
        battleMusic.pause();
        menuMusic.pause();
        loseSound.play();
        alert("GAME OVER");
        location.reload();
    }
    frameCount++;
    gameLoop = requestAnimationFrame(update);
}