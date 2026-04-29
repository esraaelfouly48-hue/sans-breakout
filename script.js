const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// HUD Elements
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const hpEl = document.getElementById('hp');
const startScreen = document.getElementById('startScreen');
const mobileControls = document.getElementById('mobileControls');
const bossDialogue = document.getElementById('bossDialogue');
const dialogueText = document.getElementById('dialogueText');

// Game State
let gameLoop;
let isPlaying = false;
let gameMode = 'breakout'; // 'breakout' or 'boss'
let score = 0;
let hp = 20;
let level = 1;
let frameCount = 0;

// Player (Starts as a Paddle, becomes a Heart)
let player = {
    x: canvas.width / 2 - 40,
    y: canvas.height - 30,
    width: 80,
    height: 10,
    speed: 6,
    color: 'white'
};

// --- BREAKOUT VARIABLES ---
let ball = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    dx: 4,
    dy: -4,
    radius: 6
};

let bricks = [];
const brickCols = 5;
let brickRows = 3;
const brickWidth = 60;
const brickHeight = 20;
const brickPadding = 15;
const brickOffsetTop = 50;
const brickOffsetLeft = 20;

// --- BOSS VARIABLES ---
let bones = [];

// --- CONTROLS ---
const keys = { ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; });

const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowLeft = true; });
btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowLeft = false; });
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowRight = true; });
btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowRight = false; });

// --- SETUP FUNCTIONS ---

function initBricks() {
    bricks = [];
    for (let c = 0; c < brickCols; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRows; r++) {
            bricks[c][r] = { x: 0, y: 0, status: 1 };
        }
    }
}

function startGame(mode) {
    startScreen.classList.add('hidden');
    bossDialogue.classList.add('hidden');
    if (mode === 'mobile') mobileControls.classList.remove('hidden');

    // Reset Everything
    score = 0;
    hp = 20;
    level = 1;
    gameMode = 'breakout';
    brickRows = 3;
    frameCount = 0;
    
    // Set Player to Paddle
    player.width = 80;
    player.height = 10;
    player.color = 'white';
    player.y = canvas.height - 30;

    resetBall();
    initBricks();
    updateHUD();
    
    isPlaying = true;
    gameLoop = requestAnimationFrame(update);
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 50;
    ball.dx = 4 * (Math.random() > 0.5 ? 1 : -1);
    ball.dy = -4;
}

function updateHUD() {
    scoreEl.innerText = score;
    levelEl.innerText = level;
    hpEl.innerText = hp;
}

function startBossFight() {
    gameMode = 'boss';
    bones = [];
    
    // Morph player into the Red Soul
    player.width = 20;
    player.height = 20;
    player.color = 'red';
    player.x = canvas.width / 2 - 10;
    player.y = canvas.height - 40;

    // Dramatic Pause
    isPlaying = false;
    bossDialogue.classList.remove('hidden');
    dialogueText.innerText = "you've broken enough blocks...\nnow it's my turn.";
    
    setTimeout(() => {
        bossDialogue.classList.add('hidden');
        isPlaying = true;
        gameLoop = requestAnimationFrame(update);
    }, 3000);
}

function gameOver() {
    isPlaying = false;
    alert(`GAME OVER! You reached Level ${level} with ${score} points.`);
    startScreen.classList.remove('hidden');
    mobileControls.classList.add('hidden');
}

// --- GAME LOOP ---

function update() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Player Movement (Works for both paddle and heart)
    if (keys.ArrowLeft && player.x > 0) player.x -= player.speed;
    if (keys.ArrowRight && player.x < canvas.width - player.width) player.x += player.speed;

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    if (gameMode === 'breakout') {
        runBreakoutLogic();
    } else if (gameMode === 'boss') {
        runBossLogic();
    }

    if (isPlaying) {
        frameCount++;
        gameLoop = requestAnimationFrame(update);
    }
}

// --- MODE LOGIC ---

function runBreakoutLogic() {
    // Draw Ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.closePath();

    // Ball Wall Collision
    if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) ball.dx = -ball.dx;
    if (ball.y + ball.dy < ball.radius) ball.dy = -ball.dy;

    // Ball Paddle Collision
    if (ball.y + ball.dy > player.y - ball.radius && ball.x > player.x && ball.x < player.x + player.width) {
        ball.dy = -ball.dy;
        // Add a little spin depending on where it hits the paddle
        ball.dx += (ball.x - (player.x + player.width / 2)) * 0.05; 
    }

    // Ball Bottom Death
    if (ball.y + ball.dy > canvas.height - ball.radius) {
        hp -= 2; // Lose 2 HP for dropping the ball
        updateHUD();
        if (hp <= 0) { gameOver(); return; }
        resetBall();
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Draw & Break Bricks
    let activeBricks = 0;
    for (let c = 0; c < brickCols; c++) {
        for (let r = 0; r < brickRows; r++) {
            let b = bricks[c][r];
            if (b.status === 1) {
                let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                b.x = brickX;
                b.y = brickY;
                
                ctx.fillStyle = '#00aaff';
                ctx.fillRect(brickX, brickY, brickWidth, brickHeight);
                activeBricks++;

                // Brick Collision
                if (ball.x > b.x && ball.x < b.x + brickWidth && ball.y > b.y && ball.y < b.y + brickHeight) {
                    ball.dy = -ball.dy;
                    b.status = 0;
                    score += 10;
                    updateHUD();
                }
            }
        }
    }

    // Level Up Check
    if (activeBricks === 0) {
        level++;
        updateHUD();
        if (level === 3) {
            startBossFight(); // TIME FOR SANS
        } else {
            // Level 2 logic
            brickRows = 4;
            initBricks();
            resetBall();
            ball.dx *= 1.2; // Faster ball
            ball.dy *= 1.2;
        }
    }
}

function runBossLogic() {
    // Spawn Bones
    let spawnRate = Math.max(10, 30 - Math.floor((score - 150) / 20)); 
    if (frameCount % spawnRate === 0) {
        bones.push({
            x: Math.random() * (canvas.width - 20),
            y: -30,
            width: 15 + Math.random() * 15,
            height: 30,
            speed: 4 + Math.random() * 3
        });
    }

    // Draw and Move Bones
    ctx.fillStyle = 'white';
    for (let i = 0; i < bones.length; i++) {
        let b = bones[i];
        b.y += b.speed;
        ctx.fillRect(b.x, b.y, b.width, b.height);

        // Player Hit
        if (player.x < b.x + b.width && player.x + player.width > b.x &&
            player.y < b.y + b.height && player.y + player.height > b.y) {
            hp -= 1;
            updateHUD();
            bones.splice(i, 1);
            i--;
            if (hp <= 0) { gameOver(); return; }
            continue;
        }

        // Bone Dodged
        if (b.y > canvas.height) {
            score += 5;
            updateHUD();
            bones.splice(i, 1);
            i--;
        }
    }
}