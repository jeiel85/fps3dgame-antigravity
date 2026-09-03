import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sound } from './audio.js';

export class WeaponSystem {
  constructor(camera, scene, physicsWorld, particleSystem) {
    this.camera = camera;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.particles = particleSystem;

    // Raycaster for hitscan shots
    this.raycaster = new THREE.Raycaster();

    // Weapon holder attached to camera for 1st-person viewmodel
    this.holder = new THREE.Group();
    this.camera.add(this.holder);

    // ADS state
    this.isAiming = false;
    this.defaultFov = 75;
    this.aimFov = 50;

    // Weapon Definitions
    this.weapons = [
      {
        id: 'pistol',
        name: 'CYBER PISTOL',
        type: 'semi',
        damage: 38,
        magSize: 12,
        currentAmmo: 12,
        fireRate: 0.2, // seconds
        reloadTime: 1.2,
        range: 80,
        pellets: 1,
        spread: 0.008,
        impulseForce: 12,
        tracerColor: 0x00ffff,
        soundFunc: () => sound.playPistol(),
        defaultPos: new THREE.Vector3(0.24, -0.22, -0.45),
        aimPos: new THREE.Vector3(0, -0.165, -0.35),
        mesh: null
      },
      {
        id: 'rifle',
        name: 'PULSE RIFLE',
        type: 'auto',
        damage: 24,
        magSize: 32,
        currentAmmo: 32,
        fireRate: 0.1,
        reloadTime: 1.8,
        range: 100,
        pellets: 1,
        spread: 0.02,
        impulseForce: 18,
        tracerColor: 0xffaa00,
        soundFunc: () => sound.playRifle(),
        defaultPos: new THREE.Vector3(0.22, -0.24, -0.48),
        aimPos: new THREE.Vector3(0, -0.19, -0.38),
        mesh: null
      },
      {
        id: 'shotgun',
        name: 'SCATTER CANNON',
        type: 'semi',
        damage: 18, // per pellet (x8)
        magSize: 8,
        currentAmmo: 8,
        fireRate: 0.7,
        reloadTime: 2.2,
        range: 40,
        pellets: 8,
        spread: 0.07,
        impulseForce: 35,
        tracerColor: 0xff2255,
        soundFunc: () => sound.playShotgun(),
        defaultPos: new THREE.Vector3(0.24, -0.26, -0.5),
        aimPos: new THREE.Vector3(0, -0.2, -0.42),
        mesh: null
      }
    ];

    this.currentIndex = 0;
    this.currentWeapon = this.weapons[0];

    // State
    this.timeSinceLastShot = 999;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.recoilOffset = new THREE.Vector3();
    this.recoilRot = new THREE.Vector3();

    // Muzzle Flash
    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 10);
    this.scene.add(this.muzzleLight);

    // Callbacks
    this.onAmmoChange = null;
    this.onHitEnemy = null;

    // Create 3D Viewmodels
    this.createWeaponModels();
    this.selectWeapon(0);
  }

  createWeaponModels() {
    // 1. Pistol Model
    const pistolGroup = new THREE.Group();
    const gunDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e2229, metalness: 0.8, roughness: 0.3 });
    const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x667788, metalness: 0.9, roughness: 0.2 });
    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    // Body
    const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.24), gunDarkMat);
    pistolGroup.add(pBody);
    // Slide top
    const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.04, 0.25), gunMetalMat);
    pSlide.position.set(0, 0.05, -0.01);
    pistolGroup.add(pSlide);
    // Grip
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.07), gunDarkMat);
    pGrip.position.set(0, -0.09, 0.06);
    pGrip.rotation.x = -0.25;
    pistolGroup.add(pGrip);
    // Glow accents
    const pGlow = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.01, 0.16), cyanGlowMat);
    pGlow.position.set(0, 0.04, 0);
    pistolGroup.add(pGlow);
    // Barrel tip
    const pTip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 8), gunDarkMat);
    pTip.rotation.x = Math.PI / 2;
    pTip.position.set(0, 0.05, -0.14);
    pistolGroup.add(pTip);

    this.weapons[0].mesh = pistolGroup;
    this.holder.add(pistolGroup);

    // 2. Pulse Rifle Model
    const rifleGroup = new THREE.Group();
    const orangeGlowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    // Receiver
    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.52), gunDarkMat);
    rifleGroup.add(rBody);
    // Long barrel
    const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), gunMetalMat);
    rBarrel.rotation.x = Math.PI / 2;
    rBarrel.position.set(0, 0.02, -0.38);
    rifleGroup.add(rBarrel);
    // Shroud / Handguard
    const rShroud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.26), gunMetalMat);
    rShroud.position.set(0, 0.02, -0.24);
    rifleGroup.add(rShroud);
    // Mag
    const rMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.07), gunDarkMat);
    rMag.position.set(0, -0.12, 0.05);
    rMag.rotation.x = 0.2;
    rifleGroup.add(rMag);
    // Stock
    const rStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.18), gunDarkMat);
    rStock.position.set(0, -0.01, 0.32);
    rifleGroup.add(rStock);
    // Holographic Sight
    const rSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), gunDarkMat);
    rSight.position.set(0, 0.08, -0.04);
    rifleGroup.add(rSight);
    const rSightLens = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.015, 12), orangeGlowMat);
    rSightLens.position.set(0, 0.08, -0.081);
    rifleGroup.add(rSightLens);
    // Glow stripe
    const rGlow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.015, 0.3), orangeGlowMat);
    rGlow.position.set(0, 0.01, -0.05);
    rifleGroup.add(rGlow);

    this.weapons[1].mesh = rifleGroup;
    this.holder.add(rifleGroup);

    // 3. Scatter Cannon (Shotgun) Model
    const shotgunGroup = new THREE.Group();
    const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff2255 });
    // Heavy Receiver
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.11, 0.44), gunDarkMat);
    shotgunGroup.add(sBody);
    // Dual Heavy Barrels
    const sB1 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 8), gunMetalMat);
    sB1.rotation.x = Math.PI / 2;
    sB1.position.set(-0.025, 0.03, -0.36);
    shotgunGroup.add(sB1);
    const sB2 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 8), gunMetalMat);
    sB2.rotation.x = Math.PI / 2;
    sB2.position.set(0.025, 0.03, -0.36);
    shotgunGroup.add(sB2);
    // Pump grip
    const sPump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.16), gunDarkMat);
    sPump.position.set(0, -0.02, -0.28);
    shotgunGroup.add(sPump);
    // Stock
    const sStock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.22), gunDarkMat);
    sStock.position.set(0, -0.02, 0.3);
    shotgunGroup.add(sStock);
    // Neon Red Accents
    const sGlow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.25), redGlowMat);
    sGlow.position.set(0, 0.02, -0.05);
    shotgunGroup.add(sGlow);

    this.weapons[2].mesh = shotgunGroup;
    this.holder.add(shotgunGroup);
  }

  selectWeapon(index) {
    if (index < 0 || index >= this.weapons.length) return;
    if (this.isReloading) {
      this.isReloading = false;
    }

    this.currentIndex = index;
    this.currentWeapon = this.weapons[index];

    // Hide all meshes except active
    this.weapons.forEach((w, i) => {
      if (w.mesh) {
        w.mesh.visible = (i === index);
      }
    });

    if (this.onAmmoChange) {
      this.onAmmoChange(this.currentWeapon);
    }
  }

  nextWeapon() {
    const nextIdx = (this.currentIndex + 1) % this.weapons.length;
    this.selectWeapon(nextIdx);
  }

  prevWeapon() {
    const prevIdx = (this.currentIndex - 1 + this.weapons.length) % this.weapons.length;
    this.selectWeapon(prevIdx);
  }

  setAim(aiming) {
    this.isAiming = aiming;
  }

  reload() {
    const w = this.currentWeapon;
    if (this.isReloading || w.currentAmmo >= w.magSize) return;

    this.isReloading = true;
    this.reloadTimer = w.reloadTime;
    sound.playReload();

    if (this.onAmmoChange) {
      this.onAmmoChange(w, true);
    }
  }

  shoot(shootables, botList = []) {
    const w = this.currentWeapon;
    if (this.isReloading || this.timeSinceLastShot < w.fireRate) return false;

    if (w.currentAmmo <= 0) {
      this.reload();
      return false;
    }

    // Spend Ammo
    w.currentAmmo--;
    this.timeSinceLastShot = 0;
    w.soundFunc();

    // Recoil Kick
    const kickMult = this.isAiming ? 0.4 : 1.0;
    this.recoilOffset.z += (w.id === 'shotgun' ? 0.12 : 0.06) * kickMult;
    this.recoilRot.x += (w.id === 'shotgun' ? 0.18 : 0.08) * kickMult;

    // Muzzle Flash
    this.triggerMuzzleFlash(w.tracerColor);

    // Eject Shell Casing
    const gunWorldPos = new THREE.Vector3();
    w.mesh.getWorldPosition(gunWorldPos);
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.particles.createShellCasing(gunWorldPos, rightVec);

    // Calculate Shots & Raycasts
    const camPos = this.camera.position.clone();
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const hitColliders = [];
    shootables.forEach(s => {
      if (s.mesh) hitColliders.push(s.mesh);
    });

    // Also include bot mesh hitboxes
    botList.forEach(bot => {
      if (bot.isAlive && bot.hitMesh) {
        hitColliders.push(bot.hitMesh);
      }
    });

    for (let i = 0; i < w.pellets; i++) {
      // Calculate Spread
      const spread = this.isAiming ? w.spread * 0.4 : w.spread;
      const spreadX = (Math.random() - 0.5) * spread;
      const spreadY = (Math.random() - 0.5) * spread;

      const rayDir = camDir.clone()
        .add(rightVec.clone().multiplyScalar(spreadX))
        .add(new THREE.Vector3(0, 1, 0).multiplyScalar(spreadY))
        .normalize();

      this.raycaster.set(camPos, rayDir);
      this.raycaster.far = w.range;

      const intersects = this.raycaster.intersectObjects(hitColliders, false);

      let targetPos;
      if (intersects.length > 0) {
        const hit = intersects[0];
        targetPos = hit.point.clone();

        // 1. Check if hit Bot
        const hitBot = botList.find(b => b.hitMesh === hit.object);
        if (hitBot && hitBot.isAlive) {
          hitBot.takeDamage(w.damage, hit.point, rayDir.clone().multiplyScalar(w.impulseForce));
          this.particles.createHitSparks(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), 'bot');
          sound.playHitmarker();
          if (this.onHitEnemy) {
            this.onHitEnemy(w.damage, hitBot.health <= 0);
          }
        } else {
          // 2. Hit static or interactive physics object
          const shootableObj = shootables.find(s => s.mesh === hit.object);
          if (shootableObj) {
            if (shootableObj.onHit) {
              shootableObj.onHit(w.damage, hit.point);
            }

            // Apply Cannon-es physics impulse!
            if (shootableObj.body && shootableObj.body.mass > 0) {
              const impulse = new CANNON.Vec3(
                rayDir.x * w.impulseForce,
                (rayDir.y + 0.2) * w.impulseForce,
                rayDir.z * w.impulseForce
              );
              const hitPointCannon = new CANNON.Vec3(hit.point.x, hit.point.y, hit.point.z);
              shootableObj.body.applyImpulse(impulse, hitPointCannon);
              shootableObj.body.wakeUp();
            }
          }

          this.particles.createHitSparks(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), 'metal');
        }
      } else {
        // Hit empty air / max range
        targetPos = camPos.clone().add(rayDir.clone().multiplyScalar(w.range));
      }

      // Tracer line from gun tip to hit point
      const muzzlePos = gunWorldPos.clone().add(rayDir.clone().multiplyScalar(0.5));
      this.particles.createTracer(muzzlePos, targetPos, w.tracerColor);
    }

    if (this.onAmmoChange) {
      this.onAmmoChange(w);
    }

    return true;
  }

  triggerMuzzleFlash(colorHex) {
    this.muzzleLight.color.setHex(colorHex);
    this.muzzleLight.intensity = 5;
    const w = this.currentWeapon;
    const wp = new THREE.Vector3();
    w.mesh.getWorldPosition(wp);
    this.muzzleLight.position.copy(wp);

    setTimeout(() => {
      this.muzzleLight.intensity = 0;
    }, 45);
  }

  update(dt, isMoving, isSprinting) {
    this.timeSinceLastShot += dt;

    // Handle Reload
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.currentWeapon.currentAmmo = this.currentWeapon.magSize;
        if (this.onAmmoChange) {
          this.onAmmoChange(this.currentWeapon);
        }
      }
    }

    // Weapon Sway & Bobbing animation
    const w = this.currentWeapon;
    const targetPos = (this.isAiming ? w.aimPos : w.defaultPos).clone();

    // Bobbing offset
    const time = performance.now() * 0.006;
    if (isMoving && !this.isAiming) {
      const speedMult = isSprinting ? 1.6 : 1.0;
      targetPos.x += Math.cos(time * speedMult) * 0.012;
      targetPos.y += Math.sin(time * 2 * speedMult) * 0.012;
    }

    // Reload animation dip
    if (this.isReloading) {
      const progress = 1 - (this.reloadTimer / w.reloadTime);
      targetPos.y -= Math.sin(progress * Math.PI) * 0.2;
      targetPos.z += Math.sin(progress * Math.PI) * 0.08;
    }

    // Recoil recovery
    this.recoilOffset.lerp(new THREE.Vector3(), dt * 14);
    this.recoilRot.lerp(new THREE.Vector3(), dt * 14);

    targetPos.add(this.recoilOffset);

    // Lerp weapon mesh position & rotation
    w.mesh.position.lerp(targetPos, dt * 18);
    w.mesh.rotation.x = THREE.MathUtils.lerp(w.mesh.rotation.x, this.recoilRot.x, dt * 20);

    // Camera FOV zoom for ADS
    const targetFov = this.isAiming ? this.aimFov : this.defaultFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 12);
      this.camera.updateProjectionMatrix();
    }
  }
}
