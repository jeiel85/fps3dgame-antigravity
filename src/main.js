import * as THREE from 'three';
import { PhysicsWorld } from './physics.js';
import { ParticleSystem } from './particles.js';
import { ArenaMap } from './map.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { Bot } from './bot.js';
import { UIManager } from './ui.js';
import { sound } from './audio.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // Game stats
    this.wave = 1;
    this.score = 0;
    this.gameState = 'INIT'; // 'INIT', 'PLAYING', 'GAMEOVER', 'VICTORY'
    this.bots = [];

    // Mouse state for auto-firing weapons
    this.isMouseDown = false;

    this.initThree();
    this.initGameSystems();
    this.initEventListeners();
    this.startWave(1);

    // Render loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060912);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.scene.add(this.camera);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);
  }

  initGameSystems() {
    // 1. Physics Engine (cannon-es)
    this.physics = new PhysicsWorld();

    // 2. Particles
    this.particles = new ParticleSystem(this.scene);

    // 3. Arena Map & Props
    this.map = new ArenaMap(this.scene, this.physics, this.particles);

    // 4. Player
    this.player = new Player(this.camera, this.renderer.domElement, this.physics);

    // 5. Weapons
    this.weapons = new WeaponSystem(this.camera, this.scene, this.physics, this.particles);

    // 6. UI
    this.ui = new UIManager();
    this.ui.updateWeapon(this.weapons.currentWeapon);

    // Hook callbacks
    this.weapons.onAmmoChange = (weapon, isReloading) => {
      this.ui.updateWeapon(weapon, isReloading);
    };

    this.weapons.onHitEnemy = (damage, isFatal) => {
      this.ui.showHitmarker(isFatal);
      this.score += Math.floor(damage * 10);
      if (isFatal) {
        this.score += 250;
      }
      this.updateStatsUI();
    };

    this.player.onDamageTaken = (hp, shield, sourcePos) => {
      this.ui.updateHealth(hp, shield);
      this.ui.flashDamage();
    };

    this.player.onDeath = () => {
      this.gameState = 'GAMEOVER';
      this.ui.showGameOver(true, this.score);
      this.player.unlock();
    };

    // Explosive barrel shockwave damage to nearby bots & player
    this.map.onBarrelExploded = (pos, radius, maxDamage) => {
      // Check Player
      const pDist = this.player.camera.position.distanceTo(pos);
      if (pDist < radius) {
        const factor = 1 - (pDist / radius);
        this.player.takeDamage(maxDamage * factor, pos);
      }

      // Check Bots
      for (const bot of this.bots) {
        if (!bot.isAlive) continue;
        const bDist = bot.group.position.distanceTo(pos);
        if (bDist < radius) {
          const factor = 1 - (bDist / radius);
          const knockback = bot.group.position.clone().sub(pos).normalize().multiplyScalar(40 * factor);
          bot.takeDamage(maxDamage * factor, pos, knockback);
          if (bot.health <= 0) {
            this.score += 300;
          }
        }
      }
      this.updateStatsUI();
      this.checkWaveProgress();
    };
  }

  initEventListeners() {
    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Start Game on button or start screen click
    const startBtn = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');
    const startGame = () => {
      sound.init();
      this.ui.showStartScreen(false);
      this.gameState = 'PLAYING';
      this.player.lock();
    };

    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
      });
    }
    if (startScreen) {
      startScreen.addEventListener('click', startGame);
    }

    // Re-lock pointer on canvas click while playing
    window.addEventListener('click', (e) => {
      if (this.gameState === 'PLAYING' && !this.player.isLocked) {
        if (!e.target || !e.target.closest('button')) {
          this.player.lock();
        }
      }
    });

    // Retry Button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.ui.showGameOver(false);
        this.score = 0;
        this.player.reset(0, 3, 20);
        this.ui.updateHealth(this.player.health, this.player.shield);
        this.startWave(1);
        this.gameState = 'PLAYING';
        this.player.lock();
      });
    }

    // Next Wave Button
    const nextWaveBtn = document.getElementById('next-wave-btn');
    if (nextWaveBtn) {
      nextWaveBtn.addEventListener('click', () => {
        this.ui.showVictory(false);
        this.wave++;
        this.player.reset(0, 3, 20);
        this.player.shield = this.player.maxShield;
        this.ui.updateHealth(this.player.health, this.player.shield);
        this.startWave(this.wave);
        this.gameState = 'PLAYING';
        this.player.lock();
      });
    }

    // Mouse controls
    window.addEventListener('mousedown', (e) => {
      if (this.gameState !== 'PLAYING') return;

      if (e.button === 0) { // Left Click (Shoot)
        this.isMouseDown = true;
        this.tryShoot();
      } else if (e.button === 2) { // Right Click (ADS)
        this.weapons.setAim(true);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      } else if (e.button === 2) {
        this.weapons.setAim(false);
      }
    });

    // Disable context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Weapon Switching & Reload
    window.addEventListener('keydown', (e) => {
      if (this.gameState !== 'PLAYING') return;

      switch (e.code) {
        case 'Digit1':
          this.weapons.selectWeapon(0);
          break;
        case 'Digit2':
          this.weapons.selectWeapon(1);
          break;
        case 'Digit3':
          this.weapons.selectWeapon(2);
          break;
        case 'KeyR':
          this.weapons.reload();
          break;
      }
    });

    // Mouse Wheel weapon cycle
    window.addEventListener('wheel', (e) => {
      if (this.gameState !== 'PLAYING') return;
      if (e.deltaY > 0) {
        this.weapons.nextWeapon();
      } else if (e.deltaY < 0) {
        this.weapons.prevWeapon();
      }
    });
  }

  tryShoot() {
    const fired = this.weapons.shoot(this.map.shootables, this.bots);
    if (fired) {
      this.ui.setCrosshairSpread(true);
      setTimeout(() => this.ui.setCrosshairSpread(false), 80);
      this.checkWaveProgress();
    }
  }

  startWave(waveNum) {
    this.wave = waveNum;

    // Clear existing bots
    for (const bot of this.bots) {
      bot.cleanup();
      if (bot.group && bot.group.parent) {
        this.scene.remove(bot.group);
      }
      if (bot.body) {
        this.physics.world.removeBody(bot.body);
      }
    }
    this.bots = [];

    // Bot count scales per wave (3, 5, 7...)
    const botCount = 2 + waveNum * 2;

    const spawnPoints = [
      { x: -18, z: -18 },
      { x: 18, z: -18 },
      { x: -18, z: 18 },
      { x: 18, z: 18 },
      { x: 0, z: -22 },
      { x: -22, z: 0 },
      { x: 22, z: 0 },
      { x: 0, z: 2 }
    ];

    for (let i = 0; i < botCount; i++) {
      const sp = spawnPoints[i % spawnPoints.length];
      const initialPos = new THREE.Vector3(
        sp.x + (Math.random() - 0.5) * 4,
        2,
        sp.z + (Math.random() - 0.5) * 4
      );

      // Procedural patrol waypoints
      const waypoints = [
        { x: sp.x, z: sp.z },
        { x: sp.x * 0.4, z: sp.z * 0.4 },
        { x: -sp.x * 0.5, z: sp.z * 0.5 }
      ];

      const bot = new Bot(this.scene, this.physics, this.particles, initialPos, waypoints);
      bot.onDestroyed = () => {
        this.checkWaveProgress();
      };
      this.bots.push(bot);
    }

    this.updateStatsUI();
  }

  checkWaveProgress() {
    const aliveBots = this.bots.filter(b => b.isAlive);
    this.updateStatsUI();

    if (aliveBots.length === 0 && this.gameState === 'PLAYING') {
      this.gameState = 'VICTORY';
      this.score += this.wave * 1000;
      this.updateStatsUI();
      this.player.unlock();
      this.ui.showVictory(true, this.wave);
    }
  }

  updateStatsUI() {
    const aliveBots = this.bots.filter(b => b.isAlive).length;
    this.ui.updateStats(this.wave, aliveBots, this.score);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05); // Cap to prevent physics tunneling

    if (this.gameState === 'PLAYING') {
      // 1. Update Player Inputs & Desired Velocities
      const { isMoving, isSprinting } = this.player.update(dt);

      // 2. Step Physics World (Rigid body movement & collision)
      this.physics.step(dt);

      // 3. Sync Camera to post-physics body position
      this.player.syncCamera();

      // 4. Update Map (Jump pads cooldown)
      this.map.update(dt);

      // 5. Check Jump Pad trigger
      this.map.checkJumpPads(this.player.body.position, (force) => {
        this.player.applyBoost(force);
      });

      // 4. Auto-fire for automatic weapons (Pulse Rifle)
      if (this.isMouseDown && this.weapons.currentWeapon.type === 'auto') {
        this.tryShoot();
      }

      // 5. Update Weapons (bobbing, recoil, ADS)
      this.weapons.update(dt, isMoving, isSprinting);

      // 6. Update Bots AI
      for (const bot of this.bots) {
        bot.update(dt, this.player, this.map.shootables);
      }

      // 7. Update Radar Mini-map
      this.ui.renderRadar(
        this.player.camera.position,
        this.player.yaw,
        this.bots
      );
    }

    // 8. Update Particle System (always animate)
    this.particles.update(dt);

    // 9. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate Game on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
