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
            console.warn(`Missing music: ${name}`);
            return;
        }

        track.currentTime = 0;
        track.play().catch(err => {
            console.log('Audio error:', err);
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
            console.warn(`Missing sfx: ${name}`);
            return;
        }

        sfx.currentTime = 0;
        sfx.play().catch(() => {});
    }
};

const Game = {
    state: 'BOOT',
    hp: 100,
    maxHp: 100,
    enemyHp: 100,
    maxEnemyHp: 100,
    battleTimer: null,
    battleRunning: false,

    init() {
        this.hp = this.maxHp;
        this.enemyHp = this.maxEnemyHp;
        this.updateUI();
        this.showScreen('boot-screen');
    },

    showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            if (screen.id === screenId) {
                screen.classList.add('active');
            } else {
                screen.classList.remove('active');
            }
        });
    },

    updateUI() {
        const hpText = document.getElementById('ui-hp');
        const hpBar = document.getElementById('hp-bar-fill');
        const enemyHpText = document.getElementById('enemy-hp');
        const enemyHpBar = document.getElementById('enemy-hp-bar-fill');

        if (hpText) {
            hpText.innerText = `${Math.ceil(this.hp)}/${this.maxHp}`;
        }

        if (hpBar) {
            const hpPercent = Math.max(0, (this.hp / this.maxHp) * 100);
            hpBar.style.width = `${hpPercent}%`;
        }

        if (enemyHpText) {
            enemyHpText.innerText = `${Math.ceil(this.enemyHp)}/${this.maxEnemyHp}`;
        }

        if (enemyHpBar) {
            const enemyPercent = Math.max(0, (this.enemyHp / this.maxEnemyHp) * 100);
            enemyHpBar.style.width = `${enemyPercent}%`;
        }
    },

    startMenu() {
        this.state = 'MENU';
        this.battleRunning = false;
        this.clearBattleTimer();
        this.hp = this.maxHp;
        this.enemyHp = this.maxEnemyHp;
        this.updateUI();
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

    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;

        this.updateUI();

        if (this.hp <= 0) {
            this.loseBattle();
        }
    },

    winBattle() {
        this.battleRunning = false;
        this.clearBattleTimer();
        AudioSys.stopAllMusic();
        alert('You won!');
        this.startMenu();
    },

    loseBattle() {
        this.battleRunning = false;
        this.clearBattleTimer();
        AudioSys.stopAllMusic();
        alert('Game Over');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const bootScreen = document.getElementById('boot-screen');
    const startBattleBtn = document.getElementById('start-battle-btn');
    const startBossBtn = document.getElementById('start-boss-btn');
    const attackBtn = document.getElementById('attack-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const musicSlider = document.getElementById('vol-music');
    const sfxSlider = document.getElementById('vol-sfx');

    if (bootScreen) {
        bootScreen.addEventListener('pointerup', () => {
            AudioSys.init();

            const boot = document.getElementById('boot-screen');
            const menu = document.getElementById('menu-screen');

            if (boot) boot.classList.remove('active');
            if (menu) menu.classList.add('active');

            Game.state = 'MENU';
            Game.hp = Game.maxHp;
            Game.enemyHp = Game.maxEnemyHp;
            Game.updateUI();

            AudioSys.playMusic('menu');
        });
    }

    if (startBattleBtn) {
        startBattleBtn.addEventListener('click', () => {
            Game.startBattle();
        });
    }

    if (startBossBtn) {
        startBossBtn.addEventListener('click', () => {
            Game.startBossBattle();
        });
    }

    if (attackBtn) {
        attackBtn.addEventListener('click', () => {
            Game.attackEnemy(10);
        });
    }

    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', () => {
            Game.startMenu();
        });
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

    Game.init();
});

document.addEventListener('keydown', (e) => {
    if (Game.state !== 'BATTLE' && Game.state !== 'BOSS') return;

    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        Game.attackEnemy(10);
    }
});