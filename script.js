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
        // Do NOT autoplay here. Browser audio rules will block it.
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

        track.play()
            .then(() => {
                console.log("Playing:", name);
            })
            .catch(err => {
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
    shake: 0,
    battleRunning: false,
    battleTimer: null,

    start() {
        this.state = 'MENU';
        this.hp = this.maxHp;
        this.enemyHp = this.maxEnemyHp;
        this.updateUI();
    },

    updateUI() {
        const hpText = document.getElementById('ui-hp');
        const hpBar = document.getElementById('hp-bar-fill');

        if (hpText) {
            hpText.innerText = `${Math.ceil(this.hp)}/${this.maxHp}`;
        }

        if (hpBar) {
            hpBar.style.width = `${(this.hp / this.maxHp) * 100}%`;
        }

        const enemyHpText = document.getElementById('enemy-hp');
        const enemyHpBar = document.getElementById('enemy-hp-bar-fill');

        if (enemyHpText) {
            enemyHpText.innerText = `${Math.ceil(this.enemyHp)}/${this.maxEnemyHp}`;
        }

        if (enemyHpBar) {
            enemyHpBar.style.width = `${(this.enemyHp / this.maxEnemyHp) * 100}%`;
        }
    },

    showScreen(screenId) {
        const screens = ['boot-screen', 'menu-screen', 'battle-screen'];

        for (const id of screens) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (id === screenId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    },

    startMenu() {
        this.state = 'MENU';
        this.battleRunning = false;
        this.clearBattleTimer();

        this.showScreen('menu-screen');
        AudioSys.playMusic('menu');
    },

    startBattle() {
        this.state = 'BATTLE';
        this.battleRunning = true;

        this.hp = this.maxHp;
        this.enemyHp = this.maxEnemyHp;
        this.updateUI();

        this.showScreen('battle-screen');
        AudioSys.playMusic('battle');

        this.startEnemyLoop();
    },

    startBossBattle() {
        this.state = 'BOSS';
        this.battleRunning = true;

        this.hp = this.maxHp;
        this.enemyHp = this.maxEnemyHp;
        this.updateUI();

        this.showScreen('battle-screen');
        AudioSys.playMusic('boss');

        this.startEnemyLoop();
    },

    clearBattleTimer() {
        if (this.battleTimer) {
            clearInterval(this.battleTimer);
            this.battleTimer = null;
        }
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

        AudioSys.playSFX('talk');
        this.updateUI();

        if (this.enemyHp <= 0) {
            this.winBattle();
        }
    },

    enemyAttack() {
        const damage = this.state === 'BOSS' ? 15 : 8;

        AudioSys.playSFX('blast');
        this.takeDamage(damage);
    },

    takeDamage(d) {
        this.hp -= d;
        this.shake = 12;

        if (this.hp < 0) this.hp = 0;

        this.updateUI();

        if (this.hp <= 0) {
            this.hp = 0;
            this.updateUI();
            this.loseBattle();
        }
    },

    winBattle() {
        this.battleRunning = false;
        this.clearBattleTimer();
        AudioSys.stopAllMusic();

        alert('You won the battle!');
        this.startMenu();
    },

    loseBattle() {
        this.battleRunning = false;
        this.clearBattleTimer();
        AudioSys.stopAllMusic();

        alert('Game Over');
        location.reload();
    },

    resetGame() {
        this.battleRunning = false;
        this.clearBattleTimer();
        this.hp = this.maxHp;
        this.enemyHp = this.maxEnemyHp;
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

    if (bootScreen) {
        bootScreen.onclick = () => {
            AudioSys.init();

            const boot = document.getElementById('boot-screen');
            const menu = document.getElementById('menu-screen');

            if (boot) boot.classList.remove('active');
            if (menu) menu.classList.add('active');

            AudioSys.playMusic('menu');
            Game.state = 'MENU';
            Game.start();
        };
    }

    if (startBattleBtn) {
        startBattleBtn.onclick = () => {
            Game.startBattle();
        };
    }

    if (startBossBtn) {
        startBossBtn.onclick = () => {
            Game.startBossBattle();
        };
    }

    if (attackBtn) {
        attackBtn.onclick = () => {
            Game.attackEnemy(10);
        };
    }

    if (backToMenuBtn) {
        backToMenuBtn.onclick = () => {
            Game.startMenu();
        };
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

    Game.updateUI();
});


// =======================
// ⌨️ OPTIONAL KEY CONTROLS
// =======================
document.addEventListener('keydown', (e) => {
    if (Game.state !== 'BATTLE' && Game.state !== 'BOSS') return;

    if (e.key === ' ' || e.key === 'Enter') {
        Game.attackEnemy(10);
    }
});