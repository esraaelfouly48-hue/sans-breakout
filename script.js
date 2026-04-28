const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const menuMusic = document.getElementById("menuMusic");
const battleMusic = document.getElementById("battleMusic");
const loseMusic = document.getElementById("loseMusic");

let gameState = "START", score = 0, level = 1, hp = 20;
let gameActive = false, isInvincible = false;
let paddleWidth = 80, paddleX = 160, paddleY = 470;
let moveLeft = false, moveRight = false, moveUp = false, moveDown = false;
let balls = [], bricks = [], bullets = [];

const bossLines = ["human.", "don't you know how to greet a new pal?", "anyway... let's get to it."];
let lineIndex = 0;

// The "Wake Up" Audio Hack for modern browsers
document.body.addEventListener('click', () => {
    if (gameState === "START" && menuMusic.paused) {
        menuMusic.volume = 0.5;
        menuMusic.play().catch(e => console.log("Waiting for user interaction..."));
    }
}, { once: true });

function initBricks() {
    bricks = [];
    for(let c=0; c<6; c++) {
        bricks[c] = [];
        for(let r=0; r<4; r++) bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
}

function startGame(mode) {
    document.getElementById("startScreen").classList.add("hidden");
    if(mode === 'mobile') document.getElementById("mobileControls").classList.remove("hidden");
    
    // Switch from Menu to Battle Music properly
    menuMusic.pause();
    battleMusic.currentTime = 0;
    battleMusic.volume = 0.6;
    
    // Using a timeout prevents browser overlap glitches
    setTimeout(() => {
        battleMusic.play().catch(e => console.error("Battle music error:", e));
    }, 100);
    
    gameActive = true;
    gameState = "BREAKOUT";
    initBricks();
    balls = [{ x: 200, y: 400, dx: 4, dy: -4 }];
    requestAnimationFrame(draw);
}

function startDialogue() {
    gameState = "DIALOGUE";
    balls = [];
    document.getElementById("bossDialogue").classList.remove("hidden");
    typeLine();
}

function typeLine() {
    if (lineIndex < bossLines.length) {
        let text = bossLines[lineIndex], i = 0;
        const disp = document.getElementById("dialogueText");
        disp.innerHTML = "";
        let timer = setInterval(() => {
            disp.innerHTML += text.charAt(i); i++;
            if (i >= text.length) { 
                clearInterval(timer); 
                setTimeout(() => { lineIndex++; typeLine(); }, 1500); 
            }
        }, 50);
    } else {
        document.getElementById("bossDialogue").classList.add("hidden");
        gameState = "BOSS_FIGHT";
        paddleWidth = 16; paddleX = 192; paddleY = 350;
    }
}

function draw() {
    if (!gameActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === "BREAKOUT") {
        ctx.fillStyle = "white";
        ctx.fillRect(paddleX, 480, paddleWidth, 10);

        let remaining = 0;
        bricks.forEach((col, c) => col.forEach((br, r) => {
            if(br.status === 1) {
                remaining++;
                br.x = c * 65 + 10; br.y = r * 30 + 50;
                ctx.strokeStyle = "white"; ctx.strokeRect(br.x, br.y, 60, 20);
            }
        }));

        balls.forEach((b, i) => {
            b.x += b.dx; b.y += b.dy;
            ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI*2); ctx.fillStyle = "white"; ctx.fill();
            if(b.x < 7 || b.x > 393) b.dx *= -1;
            if(b.y < 7) b.dy *= -1;
            if(b.y > 473 && b.x > paddleX && b.x < paddleX + paddleWidth) b.dy *= -1;
            if(b.y > 505) { hp -= 5; b.x = 200; b.y = 350; b.dy = -4; if(hp <= 0) endGame(); }
            
            bricks.forEach(col => col.forEach(br => {
                if(br.status === 1 && b.x > br.x && b.x < br.x+60 && b.y > br.y && b.y < br.y+20) {
                    br.status = 0; b.dy *= -1; score += 10;
                }
            }));
        });
        
        if(remaining === 0) startDialogue();

    } else if (gameState === "BOSS_FIGHT") {
        // Boss fight boundary box
        ctx.strokeStyle = "white"; ctx.strokeRect(50, 150, 300, 250);
        ctx.fillStyle = isInvincible ? "#444" : "red";
        ctx.fillRect(paddleX, paddleY, 16, 16); // The Heart

        // SIMPLIFIED BOSS: Bullets spawn less frequently (0.02) and fall slower (dy: 3)
        if(Math.random() < 0.02) bullets.push({x: 60 + Math.random()*280, y: 150, dy: 3});
        
        bullets.forEach((bl, i) => {
            bl.y += bl.dy; 
            ctx.fillStyle = "white"; ctx.fillRect(bl.x, bl.y, 10, 10);
            
            if(!isInvincible && bl.x < paddleX+16 && bl.x+10 > paddleX && bl.y < paddleY+16 && bl.y+10 > paddleY) {
                hp -= 1; 
                isInvincible = true; 
                setTimeout(() => isInvincible = false, 800); // Longer invincibility frame
                if(hp <= 0) endGame();
            }
            if(bl.y > 400) bullets.splice(i, 1);
        });
    }

    if(moveLeft && paddleX > 0) paddleX -= 6;
    if(moveRight && paddleX < canvas.width - paddleWidth) paddleX += 6;
    if(moveUp && gameState === "BOSS_FIGHT" && paddleY > 150) paddleY -= 6;
    if(moveDown && gameState === "BOSS_FIGHT" && paddleY < 384) paddleY += 6;

    document.getElementById("score").innerText = score;
    document.getElementById("hp").innerText = hp;
    
    if(gameState !== "DIALOGUE") requestAnimationFrame(draw);
}

function endGame() { 
    gameActive = false; 
    battleMusic.pause(); 
    loseMusic.volume = 0.8;
    loseMusic.currentTime = 0;
    setTimeout(() => {
        loseMusic.play().catch(e => console.log("Lose music blocked"));
    }, 100);
    document.getElementById("gameOverScreen").classList.remove("hidden"); 
}

// Controls
const setupInput = (id, state) => {
    const btn = document.getElementById(id);
    btn.ontouchstart = (e) => { e.preventDefault(); if(id === 'leftBtn') moveLeft = true; if(id === 'rightBtn') moveRight = true; if(id === 'upBtn') moveUp = true; if(id === 'downBtn') moveDown = true; };
    btn.ontouchend = (e) => { e.preventDefault(); if(id === 'leftBtn') moveLeft = false; if(id === 'rightBtn') moveRight = false; if(id === 'upBtn') moveUp = false; if(id === 'downBtn') moveDown = false; };
};
['leftBtn', 'rightBtn', 'upBtn', 'downBtn'].forEach(id => setupInput(id));

document.addEventListener("keydown", e => {
    if(e.key === "ArrowLeft") moveLeft = true; if(e.key === "ArrowRight") moveRight = true;
    if(e.key === "ArrowUp") moveUp = true; if(e.key === "ArrowDown") moveDown = true;
});
document.addEventListener("keyup", e => {
    if(e.key === "ArrowLeft") moveLeft = false; if(e.key === "ArrowRight") moveRight = false;
    if(e.key === "ArrowUp") moveUp = false; if(e.key === "ArrowDown") moveDown = false;
});