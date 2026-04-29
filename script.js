const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// HUD Elements
const scoreEl = document.getElementById('score');
const hpEl = document.getElementById('hp');
const startScreen = document.getElementById('startScreen');
const mobileControls = document.getElementById('mobileControls');

// Game Variables
let gameLoop;
let isPlaying = false;
let score = 0;
let hp = 20;
let frameCount = 0;

// Player (The Soul)
const player = {
    x: canvas.width / 2 - 10,
    y: canvas.height - 40,
    width: 20,
    height: 20,
    speed: 5,
    dx: 0
};

// Arrays for attacks
let bones = [];

// Input tracking
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

// --- CONTROLS LOGIC ---

// Keyboard
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

// Mobile Touch Controls
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

// We use touchstart and touchend so the player keeps moving while holding the button
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowLeft = true; });
btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowLeft = false; });

btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowRight = true; });
btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowRight = false; });

// --- GAME FUNCTIONS ---

function startGame(mode) {
    startScreen.classList.add('hidden');
    
    if (mode === 'mobile') {
        mobileControls.classList.remove('hidden');
    }

    // Reset Game State
    score = 0;
    hp = 20;
    bones = [];
    player.x = canvas.width / 2 - 10;
    updateHUD();
    
    isPlaying = true;
    frameCount = 0;
    
    // Start Loop
    gameLoop = requestAnimationFrame(update);
}

function updateHUD() {
    scoreEl.innerText = score;
    hpEl.innerText = hp;
}

function spawnBone() {
    // As score goes up, bones spawn more often and fall faster
    let spawnRate = Math.max(15, 40 - Math.floor(score / 50)); 
    
    if (frameCount % spawnRate === 0) {
        let boneSpeed = 3 + (score / 200) + Math.random() * 2;
        let boneWidth = 10 + Math.random() * 15;
        
        bones.push({
            x: Math.random() * (canvas.width - boneWidth),
            y: -30,
            width: boneWidth,
            height: 30,
            speed: boneSpeed
        });
    }
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(gameLoop);
    alert(`GAME OVER! You survived with a score of ${score}`);
    
    // Reset to start screen
    startScreen.classList.remove('hidden');
    mobileControls.classList.add('hidden');
}

function update() {
    if (!isPlaying) return;
    
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Move Player
    if (keys.ArrowLeft && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys.ArrowRight && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }

    // Draw Player (Red Heart)
    ctx.fillStyle = 'red';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 2. Handle Raining Bones
    spawnBone();
    
    ctx.fillStyle = 'white';
    for (let i = 0; i < bones.length; i++) {
        let b = bones[i];
        b.y += b.speed; // Move down
        
        // Draw Bone
        ctx.fillRect(b.x, b.y, b.width, b.height);

        // Check Collision with Player
        if (
            player.x < b.x + b.width &&
            player.x + player.width > b.x &&
            player.y < b.y + b.height &&
            player.y + player.height > b.y
        ) {
            // Hit!
            hp -= 1;
            updateHUD();
            bones.splice(i, 1); // Remove the bone that hit you
            i--;
            
            if (hp <= 0) {
                gameOver();
                return; // Stop updating if dead
            }
            continue; // Skip the rest of the loop for this bone
        }

        // Remove bones that go off screen and give points!
        if (b.y > canvas.height) {
            score += 10;
            updateHUD();
            bones.splice(i, 1);
            i--;
        }
    }

    frameCount++;
    gameLoop = requestAnimationFrame(update);
}