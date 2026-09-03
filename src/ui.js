export class UIManager {
  constructor() {
    this.hpBar = document.getElementById('hp-bar');
    this.shieldBar = document.getElementById('shield-bar');
    this.hpText = document.getElementById('hp-text');
    this.shieldText = document.getElementById('shield-text');
    this.ammoCur = document.getElementById('ammo-cur');
    this.ammoMax = document.getElementById('ammo-max');
    this.reloadStatus = document.getElementById('reload-status');
    this.weaponName = document.getElementById('weapon-name');
    this.waveText = document.getElementById('wave-text');
    this.botCountText = document.getElementById('bot-count-text');
    this.scoreText = document.getElementById('score-text');
    this.crosshair = document.getElementById('crosshair');
    this.hitmarker = document.getElementById('hitmarker');
    this.damageOverlay = document.getElementById('damage-overlay');

    // Radar canvas
    this.radarCanvas = document.getElementById('radar-canvas');
    if (this.radarCanvas) {
      this.radarCtx = this.radarCanvas.getContext('2d');
    }

    // Screens
    this.startScreen = document.getElementById('start-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.victoryScreen = document.getElementById('victory-screen');

    // Slots
    this.slotButtons = [
      document.getElementById('slot-1'),
      document.getElementById('slot-2'),
      document.getElementById('slot-3')
    ];

    this.hitmarkerTimeout = null;
    this.damageTimeout = null;
  }

  updateHealth(health, shield) {
    const hpPct = Math.max(0, Math.min(100, (health / 100) * 100));
    const shPct = Math.max(0, Math.min(100, (shield / 50) * 100));

    if (this.hpBar) this.hpBar.style.width = `${hpPct}%`;
    if (this.shieldBar) this.shieldBar.style.width = `${shPct}%`;
    if (this.hpText) this.hpText.textContent = `${Math.ceil(health)}`;
    if (this.shieldText) this.shieldText.textContent = `${Math.ceil(shield)}`;
  }

  updateWeapon(weapon, isReloading = false) {
    if (!weapon) return;
    if (this.weaponName) this.weaponName.textContent = weapon.name;
    if (this.ammoCur) this.ammoCur.textContent = `${weapon.currentAmmo}`;
    if (this.ammoMax) this.ammoMax.textContent = `/ ${weapon.magSize}`;

    if (this.reloadStatus) {
      this.reloadStatus.style.display = isReloading ? 'block' : 'none';
      if (isReloading) {
        this.reloadStatus.textContent = 'RELOADING...';
      }
    }

    const slotMap = { 'pistol': 0, 'rifle': 1, 'shotgun': 2 };
    const activeIdx = slotMap[weapon.id] || 0;
    this.slotButtons.forEach((btn, idx) => {
      if (btn) {
        if (idx === activeIdx) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  updateStats(wave, botCount, score) {
    if (this.waveText) this.waveText.textContent = `WAVE ${wave}`;
    if (this.botCountText) this.botCountText.textContent = `BOTS: ${botCount}`;
    if (this.scoreText) this.scoreText.textContent = `SCORE: ${score}`;
  }

  showHitmarker(isFatal = false) {
    if (!this.hitmarker) return;
    this.hitmarker.style.opacity = '1';
    this.hitmarker.style.transform = isFatal ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, -50%) scale(1.0)';
    this.hitmarker.style.borderColor = isFatal ? '#ff0033' : '#00ffff';

    if (this.hitmarkerTimeout) clearTimeout(this.hitmarkerTimeout);
    this.hitmarkerTimeout = setTimeout(() => {
      this.hitmarker.style.opacity = '0';
    }, 120);
  }

  flashDamage() {
    if (!this.damageOverlay) return;
    this.damageOverlay.style.opacity = '0.7';

    if (this.damageTimeout) clearTimeout(this.damageTimeout);
    this.damageTimeout = setTimeout(() => {
      this.damageOverlay.style.opacity = '0';
    }, 220);
  }

  setCrosshairSpread(isSpreading) {
    if (!this.crosshair) return;
    if (isSpreading) {
      this.crosshair.classList.add('spread');
    } else {
      this.crosshair.classList.remove('spread');
    }
  }

  renderRadar(playerPos, playerYaw, bots) {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radarRange = 40; // meters

    ctx.clearRect(0, 0, w, h);

    // Radar background grid circles
    ctx.fillStyle = 'rgba(6, 12, 24, 0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, (cx - 2) * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Player position (center) & direction arrow
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Bot Blips
    bots.forEach(bot => {
      if (!bot.isAlive) return;
      const bPos = bot.group.position;
      const dx = bPos.x - playerPos.x;
      const dz = bPos.z - playerPos.z;

      // Rotate relative to player yaw
      const cos = Math.cos(playerYaw);
      const sin = Math.sin(playerYaw);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;

      const scale = (cx - 6) / radarRange;
      const screenX = cx + rx * scale;
      const screenY = cy + rz * scale;

      // Check if within radar circle
      const dist = Math.hypot(screenX - cx, screenY - cy);
      if (dist < cx - 4) {
        ctx.fillStyle = '#ff2255';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  showStartScreen(show) {
    if (this.startScreen) this.startScreen.style.display = show ? 'flex' : 'none';
  }

  showGameOver(show, finalScore = 0) {
    if (this.gameOverScreen) {
      this.gameOverScreen.style.display = show ? 'flex' : 'none';
      const scoreElem = document.getElementById('game-over-score');
      if (scoreElem) scoreElem.textContent = `FINAL SCORE: ${finalScore}`;
    }
  }

  showVictory(show, wave = 1) {
    if (this.victoryScreen) {
      this.victoryScreen.style.display = show ? 'flex' : 'none';
      const waveElem = document.getElementById('victory-wave');
      if (waveElem) waveElem.textContent = `WAVE ${wave} CLEARED!`;
    }
  }
}
