// =======================
// 🎵 AUDIO SYSTEM
// =======================
const AudioSys = {
    musicVol: 0.5,
    sfxVol: 0.5,

    sounds: {
        menu: new Audio('menu.ogg'),
        battle: new Audio('battle.ogg'),
        boss: new Audio('Megalovania.mp3'),
        talk: new Audio('just-sans-talking.mp3'),
        blast: new Audio('gaster_blaster.mp3')
    },

    init() {
        this.sounds.menu.loop = true;
        this.sounds.battle.loop = true;
        this.sounds.boss.loop = true;
        this.updateVolumes();
    },

    updateVolumes() {
        const musicSlider = document.getElementById('vol-music');
        const sfxSlider = document.getElementById('vol-sfx');

        if (musicSlider) this.musicVol = Number(musicSlider.value);
        if (sfxSlider) this.sfxVol = Number(sfxSlider.value);

        this.sounds.menu.volume = this.musicVol;
        this.sounds.battle.volume = this.musicVol;
        this.sounds.boss.volume = this.musicVol;

        this.sounds.talk.volume = this.sfxVol;
        this.sounds.blast.volume = this.sfxVol;
    },

    playMusic(name) {
        this.stopAllMusic();

        const track = this.sounds[name];
        if (!track) {
            console.warn(`Music track not found: ${name}`);
            return;
        }

        track.currentTime = 0;
        track.play().catch(err => {
            console.log("Audio error:", err);
        });
    },

    stopAllMusic() {
        ['menu', 'battle', 'boss'].forEach(name => {
            const track = this.sounds[name];
            if (!track) return;
            track.pause();
            track.currentTime = 0;
        });
    },

    playSFX(name) {
        const sfx = this.sounds[name];
        if (!sfx) {
            console.warn(`SFX not found: ${name}`);
            return;
        }

        sfx.currentTime = 0;
        sfx.play().catch(() => {});
    }
};


// =======================
// 🎮 GAME
// =======================
const Game = {
    state: 'BOOT',
    hp: 100,
    maxHp: 100,
    enemyHp: 100,
    maxEnemyHp: 100,
    score: 0,
    hiscore: Number(localStorage.getItem('determination_hiscore') || 0),
    shake: 0,
    battleRunning: false,
    battleTimer: null,
    timeLeft: 120,
    timerInterval: null,
    dialogueTimeout: null,

    start() {
        this.loadHiScore();
        this.updateUI();
        this.showScreen('menu-screen');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('hud').style.display = 'flex';
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('battle-screen').classList.add('hidden');
        document.getElementById('choice-screen').classList.add('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
        this.state = 'MENU';
    },

    loadHiScore() {
        this.hiscore = Number(localStorage.getItem('determination_hiscore') || 0);
    },

    saveHiScore() {
        if (this.score > this.hiscore) {
            this.hiscore = this.score;
            localStorage.setItem('determination_hiscore', String(this.hiscore));
        }
    },

    updateHiScore() {
        if (this.score > this.hiscore) {
            this.hiscore = this.score;
            localStorage.setItem('determination_hiscore', String(this.hiscore));
        }
    },

    updateUI() {
        const hpText = document.getElementById('ui-hp');
        const hpBar = document.getElementById('hp-bar-fill');
        const enemyHpText = document.getElementById('enemy-hp');
        const enemyHpBar = document.getElementById('enemy-hp-bar-fill');
        const scoreText = document.getElementById('ui-score');
        const hiscoreText = document.getElementById('ui-hiscore');
        const timerText = document.getElementById('ui-timer');
        const battleModeText = document.getElementById('battle-mode-text');

        if (hpText) hpText.innerText = `${Math.ceil(this.hp)}/${this.maxHp}`;
        if (hpBar) hpBar.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;

        if (enemyHpText) enemyHpText.innerText = `${Math.ceil(this.enemyHp)}/${this.maxEnemyHp}`;
        if (enemyHpBar) enemyHpBar.style.width = `${Math.max(0, (this.enemyHp / this.maxEnemyHp) * 100)}%`;

        if (scoreText) scoreText.innerText = String(this.score);
        if (hiscoreText) hiscoreText.innerText = String(this.hiscore);

        if (timerText) {
            const m = String(Math.floor(this.timeLeft / 60)).padStart(2, '0');
            const s = String(this.timeLeft % 60).padStart(2, '0');
            timerText.innerText = `${m}:${s}`;
        }

        if (battleModeText) {
            battleModeText.innerText = `MODE: ${this.state === 'BOSS' ? 'BOSS' : 'NORMAL'}`;
        }
    },

    showScreen(screenId) {
        const screens = ['boot-screen', 'menu-screen', 'battle-screen', 'choice-screen'];
        for (const id of screens) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (id === screenId) el.classList.add('active');
            else el.classList.remove('active');
        }
    },

    hideAllOverlays() {
        ['boot-screen', 'menu-screen', 'battle-screen', 'choice-screen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
    },

    showDialogue(speaker, portrait, text, duration = 2200) {
        const box = document.getElementById('dialogue-box');
        const speakerName = document.getElementById('speaker-name');
        const portraitEl = document.getElementById('portrait');
        const dialogueText = document.getElementById('dialogue-text');

        if (!box || !speakerName || !portraitEl || !dialogueText) return;

        clearTimeout(this.dialogueTimeout);

        speakerName.innerText = speaker;
        portraitEl.innerText = portrait;
        dialogueText.innerText = text;
        box.classList.remove('hidden');

        this.dialogueTimeout = setTimeout(() => {
            box.classList.add('hidden');
        }, duration);
    },

    closeDialogue() {
        clearTimeout(this.dialogueTimeout);
        const box = document.getElementById('dialogue-box');
        if (box) box.classList.add('hidden');
    },

    clearBattleTimer() {
        if (this.battleTimer) {
            clearInterval(this.battleTimer);
            this.battleTimer = null;
        }
    },

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    startCountdown() {
        this.clearTimer();
        this.timeLeft = 120;
        const timerText = document.getElementById('ui-timer');
        if (timerText) timerText.classList.remove('hidden');

        this.timerInterval = setInterval(() => {
            if (this.state !== 'BATTLE' && this.state !== 'BOSS') return;

            this.timeLeft--;
            if (this.timeLeft < 0) this.timeLeft = 0;
            this.updateUI();

            if (this.timeLeft <= 0) {
                this.loseBattle();
            }
        }, 1000);
    },

    startMenu() {
        this.state = 'MENU';
        this.battleRunning = false;
        this.clearBattleTimer();
        this.clearTimer();
        this.closeDialogue();
        this.showScreen('menu-screen');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('battle-screen').classList.add('hidden');
        document.getElementById('choice-screen').classList.add('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
        AudioSys.playMusic('menu');
        this.updateUI();
    },

    startBattle() {
        this.state = 'BATTLE';
        this.battleRunning = true;
        this.hp = this.maxHp;
        this.maxEnemyHp = 100;
        this.enemyHp = this.maxEnemyHp;
        this.score = 0;
        this.timeLeft = 120;
        this.updateUI();

        this.hideAllOverlays();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('battle-screen').classList.remove('hidden');
        document.getElementById('mobile-controls').classList.remove('hidden');

        AudioSys.playMusic('battle');
        this.startEnemyLoop();
        this.startCountdown();
        this.showDialogue('BOMB', '💣', 'THE BATTLE HAS STARTED!');
    },

    startBossBattle() {
        this.state = 'BOSS';
        this.battleRunning = true;
        this.hp = this.maxHp;
        this.maxEnemyHp = 180;
        this.enemyHp = this.maxEnemyHp;
        this.score = 0;
        this.timeLeft = 120;
        this.updateUI();

        this.hideAllOverlays();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('battle-screen').classList.remove('hidden');
        document.getElementById('mobile-controls').classList.remove('hidden');

        AudioSys.playMusic('boss');
        this.startEnemyLoop();
        this.startCountdown();
        this.showDialogue('BOMB', '💣', 'BOSS FIGHT STARTED!');
    },

    startEnemyLoop() {
        this.clearBattleTimer();

        this.battleTimer = setInterval(() => {
            if (!this.battleRunning) return;
            if (this.state !== 'BATTLE' && this.state !== 'BOSS') return;
            this.enemyAttack();
        }, 1800);
    },

    attackEnemy(amount = 10) {
        if (!this.battleRunning) return;

        this.enemyHp -= amount;
        if (this.enemyHp < 0) this.enemyHp = 0;

        this.score += amount * 10;
        AudioSys.playSFX('talk');
        this.updateHiScore();
        this.updateUI();

        if (this.enemyHp <= 0) {
            this.winBattle();
        } else {
            this.showDialogue('YOU', '⭐', `YOU HIT FOR ${amount} DAMAGE!`, 900);
        }
    },

    enemyAttack() {
        const damage = this.state === 'BOSS' ? 15 : 8;
        AudioSys.playSFX('blast');
        this.takeDamage(damage);
        this.showDialogue('ENEMY', '💣', `YOU TOOK ${damage} DAMAGE!`, 900);
    },

    takeDamage(d) {
        this.hp -= d;
        this.shake = 12;

        if (this.hp < 0) this.hp = 0;
        this.updateUI();

        if (this.hp <= 0) {
            this.loseBattle();
        }
    },

    winBattle() {
        this.battleRunning = false;
        this.clearBattleTimer();
        this.clearTimer();
        AudioSys.stopAllMusic();
        this.saveHiScore();
        this.updateUI();

        this.showScreen('choice-screen');
        this.showDialogue('BOMB', '💣', 'YOU WON. JUDGEMENT TIME.', 1800);
    },

    loseBattle() {
        if (!this.battleRunning) return;

        this.battleRunning = false;
        this.clearBattleTimer();
        this.clearTimer();
        AudioSys.stopAllMusic();
        this.saveHiScore();
        this.updateUI();

        this.showDialogue('SYSTEM', '☠️', 'GAME OVER', 1800);
        setTimeout(() => {
            this.startMenu();
        }, 1800);
    },

    chooseFight() {
        this.showDialogue('SYSTEM', '⚔️', 'YOU CHOSE FIGHT.', 1400);
        setTimeout(() => {
            this.startBossBattle();
        }, 1200);
    },

    chooseMercy() {
        this.showDialogue('SYSTEM', '💛', 'YOU CHOSE MERCY.', 1400);
        setTimeout(() => {
            this.startMenu();
        }, 1200);
    },

    resetGame() {
        this.battleRunning = false;
        this.clearBattleTimer();
        this.clearTimer();
        this.hp = this.maxHp;
        this.enemyHp = this.maxEnemyHp;
        this.score = 0;
        this.timeLeft = 120;
        this.updateUI();
    }
};


// =======================
// 🔘 BOOT / INIT
// =======================
document.addEventListener('DOMContentLoaded', () => {
    const bootScreen = document.getElementById('boot-screen');
    const startBattleBtn = document.getElementById('start-battle-btn');
    const startBossBtn = document.getElementById('start-boss-btn');
    const attackBtn = document.getElementById('attack-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const musicSlider = document.getElementById('vol-music');
    const sfxSlider = document.getElementById('vol-sfx');
    const btnPc = document.getElementById('btn-pc');
    const btnMobile = document.getElementById('btn-mobile');
    const btnKill = document.getElementById('btn-kill');
    const btnSpare = document.getElementById('btn-spare');
    const touchTrack = document.getElementById('touch-track');

    Game.loadHiScore();
    Game.updateUI();

    if (bootScreen) {
        bootScreen.onclick = () => {
            AudioSys.init();
            Game.startMenu();
        };
    }

    if (startBattleBtn) {
        startBattleBtn.onclick = () => Game.startBattle();
    }

    if (startBossBtn) {
        startBossBtn.onclick = () => Game.startBossBattle();
    }

    if (attackBtn) {
        attackBtn.onclick = () => Game.attackEnemy(10);
    }

    if (backToMenuBtn) {
        backToMenuBtn.onclick = () => Game.startMenu();
    }

    if (btnPc) {
        btnPc.onclick = () => {
            document.getElementById('mobile-controls').classList.add('hidden');
            Game.showDialogue('SYSTEM', '⌨️', 'PC MODE ENABLED', 1200);
        };
    }

    if (btnMobile) {
        btnMobile.onclick = () => {
            document.getElementById('mobile-controls').classList.remove('hidden');
            Game.showDialogue('SYSTEM', '📱', 'MOBILE MODE ENABLED', 1200);
        };
    }

    if (btnKill) {
        btnKill.onclick = () => Game.chooseFight();
    }

    if (btnSpare) {
        btnSpare.onclick = () => Game.chooseMercy();
    }

    if (musicSlider) {
        musicSlider.addEventListener('input', () => {
            AudioSys.updateVolumes();
        });
    }

    if (sfxSlider) {
        sfxSlider.addEventListener('input', () => {
            AudioSys.updateVolumes();
        });
    }

    if (touchTrack) {
        touchTrack.addEventListener('click', () => {
            if (Game.state === 'BATTLE' || Game.state === 'BOSS') {
                Game.attackEnemy(10);
            }
        });
    }

    Game.showScreen('boot-screen');
});


// =======================
// ⌨️ KEY CONTROLS
// =======================
document.addEventListener('keydown', (e) => {
    if (Game.state !== 'BATTLE' && Game.state !== 'BOSS') return;

    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        Game.attackEnemy(10);
    }

    if (e.key === 'Escape') {
        Game.startMenu();
    }
});