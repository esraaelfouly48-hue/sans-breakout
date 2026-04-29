const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const hpEl = document.getElementById('hp');
const startScreen = document.getElementById('startScreen');
const mobileControls = document.getElementById('mobileControls');
const bossDialogue = document.getElementById('bossDialogue');
const dialogueText = document.getElementById('dialogueText');

// --- SIMPLE AUDIO SETUP ---
const menuMusic = new Audio('menu.ogg');
const battleMusic = new Audio('battle.ogg');
const loseSound = new Audio('lose.ogg');

menuMusic.loop = true;
battleMusic.loop = true;

// GAME STATE
let gameLoop, isPlaying = false, gameMode = 'breakout', score = 0, hp = 20, level = 1, frameCount = 0;
let player = { x: 160, y: 470, width: 80, height: 10, speed: 8, color: 'white' };
let balls = []; 
let bricks = [], bones = [], drops = [];
let slowModeTimer = 0;

const keys = { ArrowLeft: false, ArrowRight: false };

// INPUTS
window.addEventListener('keydown', (e) => { if(keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.code)) keys[e.code] = false; });

const setupBtn = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
    el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
};
setupBtn('btnLeft', 'ArrowLeft');
setupBtn('btnRight', 'ArrowRight');

function createBall() {
    balls.push({ x: 200, y: 300, dx: (Math.random() - 0.5) * 8, dy: -4, radius: 7 });
}

function initBricks() {
    bricks = [];
    for (let c = 0; c < 5; c++) {
        bricks[c] = [];
        for (let r = 0; r < 3; r++) bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
}

function startGame(mode) {
    // --- SIMPLE MUSIC START ---
    // This happens directly on the click/tap, so the browser allows it.
    menuMusic.currentTime = 0;
    menuMusic.play();
    
    // Stop any leftover lose sounds
    loseSound.pause();
    loseSound.currentTime = 0;

    startScreen.classList.add('hidden');
    if (mode === 'mobile') mobileControls.classList.remove('hidden');
    
    score = 0; hp = 20; level = 1; gameMode = 'breakout';
    player.width = 80; player.color = 'white';
    balls = []; createBall();
    drops = []; bones = []; slowModeTimer = 0;
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
    
    // --- SIMPLE SWITCH ---
    menuMusic.pause();
    battleMusic.currentTime = 0;
    battleMusic.play();
    
    balls = [];
    player.width = 22; player.height = 22; player.color = 'red';
    player.y = 450;
    isPlaying = false;
    bossDialogue.classList.remove('hidden');
    dialogueText.innerText = "ready for a real challenge?";
    
    setTimeout(() => {
        bossDialogue.classList.add('hidden');
        isPlaying = true;
        gameLoop = requestAnimationFrame(update);
    }, 3000);
}

function update() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (slowModeTimer > 0) slowModeTimer--;

    if (keys.ArrowLeft && player.x > 0) player.x -= player.speed;
    if (keys.ArrowRight && player.x < canvas.width - player.width) player.x += player.speed;

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.shadowBlur = slowModeTimer > 0 ? 20 : 0;
    ctx.shadowColor = 'cyan';
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;

    if (gameMode === 'breakout') {
        balls.forEach((ball, bIndex) => {
            let speedMult = slowModeTimer > 0 ? 0.5 : 1;
            ball.x += ball.dx * speedMult; ball.y += ball.dy * speedMult;

            if (ball.x < 0 || ball.x > canvas.width) ball.dx *= -1;
            if (ball.y < 0) ball.dy *= -1;
            if (ball.y > player.y && ball.x > player.x && ball.x < player.x + player.width) ball.dy = -Math.abs(ball.dy);
            
            if (ball.y > canvas.height) {
                balls.splice(bIndex, 1);
                if (balls.length === 0) { hp -= 4; updateHUD(); createBall(); }
            }
            ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2);
            ctx.fillStyle = slowModeTimer > 0 ? 'cyan' : 'white';
            ctx.fill(); ctx.closePath();
        });

        let brickCount = 0;
        for(let c=0; c<5; c++) {
            for(let r=0; r<3; r++) {
                let b = bricks[c][r];
                if(b.status === 1) {
                    brickCount++;
                    b.x = c * 75 + 25; b.y = r * 35 + 50;
                    ctx.fillStyle = '#00aaff';
                    ctx.fillRect(b.x, b.y, 60, 20);
                    
                    balls.forEach(ball => {
                        if(ball.x > b.x && ball.x < b.x+60 && ball.y > b.y && ball.y < b.y+20) {
                            b.status = 0; ball.dy *= -1; score += 10;
                            if(Math.random() < 0.5) {
                                let rVal = Math.random();
                                let type = 'heart';
                                if (rVal < 0.15) type = 'bomb';
                                else if (rVal < 0.30) type = 'slow';
                                else if (rVal < 0.45) type = 'extra';
                                drops.push({x: b.x + 20, y: b.y, type: type});
                            }
                        }
                    });
                }
            }
        }

        drops.forEach((d, i) => {
            d.y += 3;
            ctx.font = "24px Arial";
            let emoji = "💚";
            if(d.type === 'bomb') emoji = "💣";
            if(d.type === 'slow') emoji = "🎈";
            if(d.type === 'extra') emoji = "⚾";
            ctx.fillText(emoji, d.x, d.y);
            
            if(d.y > player.y && d.x > player.x && d.x < player.x + player.width) {
                if(d.type === 'heart') hp = Math.min(20, hp + 2);
                if(d.type === 'bomb') hp -= 4;
                if(d.type === 'slow') slowModeTimer = 300;
                if(d.type === 'extra') createBall();
                updateHUD();
                drops.splice(i, 1);
            } else if (d.y > canvas.height) drops.splice(i, 1);
        });

        if (brickCount === 0) startBossFight();

    } else {
        let spawnRate = slowModeTimer > 0 ? 40 : 15;
        if (frameCount % spawnRate === 0) bones.push({x: Math.random()*380, y: -20, speed: 5});
        
        bones.forEach((b, i) => {
            let bSpeed = slowModeTimer > 0 ? b.speed * 0.4 : b.speed;
            b.y += bSpeed;
            ctx.fillStyle = slowModeTimer > 0 ? 'cyan' : 'white';
            ctx.fillRect(b.x, b.y, 15, 50);
            
            if (player.x < b.x + 15 && player.x + player.width > b.x && player.y < b.y + 50 && player.y + player.height > b.y) {
                hp--; updateHUD(); bones.splice(i, 1);
            }
            if (b.y > canvas.height) { bones.splice(i, 1); score += 5; updateHUD(); }
        });
    }

    if (hp <= 0) {
        isPlaying = false;
        battleMusic.pause(); menuMusic.pause(); 
        loseSound.play();
        alert("GAME OVER");
        location.reload();
    }
    frameCount++;
    gameLoop = requestAnimationFrame(update);
}