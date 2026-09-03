import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sound } from './audio.js';

export class Bot {
  constructor(scene, physicsWorld, particleSystem, initialPos, waypoints = []) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.particles = particleSystem;
    this.waypoints = waypoints;
    this.currentWaypointIdx = 0;

    // Stats
    this.maxHealth = 80;
    this.health = 80;
    this.isAlive = true;
    this.speed = 4.5;
    this.attackRange = 25;
    this.fireCooldown = 1.4; // seconds
    this.timeSinceLastShot = Math.random() * 0.8;

    // AI State: 'PATROL', 'CHASE', 'ATTACK'
    this.state = 'PATROL';
    this.target = null; // Reference to player

    // Projectile tracking
    this.projectiles = [];

    this.createMesh(initialPos);
    this.createPhysicsBody(initialPos);
    this.createHealthBar();
  }

  createMesh(pos) {
    this.group = new THREE.Group();

    // 1. Torso
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2e3542,
      metalness: 0.85,
      roughness: 0.25
    });
    const torsoGeo = new THREE.CylinderGeometry(0.4, 0.3, 0.9, 8);
    this.torso = new THREE.Mesh(torsoGeo, bodyMat);
    this.torso.position.y = 0.9;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 2. Glowing Visor Eye
    const eyeGeo = new THREE.BoxGeometry(0.3, 0.1, 0.15);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const eye = new THREE.Mesh(eyeGeo, this.eyeMat);
    eye.position.set(0, 1.2, 0.32);
    this.group.add(eye);

    // 3. Shoulder Cannons
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x181e28, metalness: 0.9, roughness: 0.2 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.45), cannonMat);
    c1.position.set(-0.48, 1.05, 0.1);
    this.group.add(c1);

    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.45), cannonMat);
    c2.position.set(0.48, 1.05, 0.1);
    this.group.add(c2);

    // 4. Hover Thruster Base
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.1, 0.3, 8), thrusterMat);
    thruster.position.set(0, 0.3, 0);
    this.group.add(thruster);

    // 5. Invisible Hitbox mesh for raycast shooting
    const hitGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitMesh = new THREE.Mesh(hitGeo, hitMat);
    this.hitMesh.position.set(0, 0.9, 0);
    this.group.add(this.hitMesh);

    this.group.position.copy(pos);
    this.scene.add(this.group);
  }

  createPhysicsBody(pos) {
    const shape = new CANNON.Sphere(0.7);
    this.body = new CANNON.Body({
      mass: 45,
      shape,
      material: this.physicsWorld.playerMaterial,
      position: new CANNON.Vec3(pos.x, pos.y + 0.8, pos.z),
      linearDamping: 0.3,
      fixedRotation: true
    });
    this.physicsWorld.world.addBody(this.body);
  }

  createHealthBar() {
    // Canvas billboard for floating HP bar
    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = 128;
    this.hpCanvas.height = 16;
    this.hpCtx = this.hpCanvas.getContext('2d');

    this.hpTexture = new THREE.CanvasTexture(this.hpCanvas);
    const spriteMat = new THREE.SpriteMaterial({ map: this.hpTexture, depthTest: false });
    this.hpSprite = new THREE.Sprite(spriteMat);
    this.hpSprite.scale.set(1.4, 0.18, 1);
    this.hpSprite.position.set(0, 2.1, 0);
    this.group.add(this.hpSprite);

    this.renderHealthBar();
  }

  renderHealthBar() {
    const ctx = this.hpCtx;
    ctx.clearRect(0, 0, 128, 16);

    // Background
    ctx.fillStyle = 'rgba(20, 20, 30, 0.8)';
    ctx.fillRect(0, 0, 128, 16);

    // Health Fill
    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffaa00' : '#ff2244';
    ctx.fillRect(2, 2, Math.floor(124 * pct), 12);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, 126, 14);

    this.hpTexture.needsUpdate = true;
  }

  takeDamage(amount, hitPoint, impulseVec) {
    if (!this.isAlive) return;

    this.health -= amount;
    this.renderHealthBar();

    // Flash eye red/white
    this.eyeMat.color.setHex(0xffffff);
    setTimeout(() => {
      if (this.eyeMat) this.eyeMat.color.setHex(0xff0044);
    }, 80);

    // Apply physics knockback
    if (impulseVec && this.body) {
      const impulse = new CANNON.Vec3(impulseVec.x, impulseVec.y * 0.4, impulseVec.z);
      this.body.applyImpulse(impulse, this.body.position);
      this.body.wakeUp();
    }

    // Switch to aggressive alert mode
    this.state = 'CHASE';

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    if (!this.isAlive) return;
    this.isAlive = false;

    sound.playBotDeath();
    this.particles.createExplosion(this.group.position, 3.5);

    // Remove from scene and physics world
    this.scene.remove(this.group);
    this.physicsWorld.world.removeBody(this.body);

    if (this.onDestroyed) {
      this.onDestroyed(this);
    }
  }

  shootAt(playerPos) {
    if (this.timeSinceLastShot < this.fireCooldown) return;
    this.timeSinceLastShot = 0;

    sound.playEnemyShoot();

    // Calculate spawn position (from shoulder blaster)
    const spawnPos = this.group.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    const dir = playerPos.clone().sub(spawnPos).normalize();

    // Add slight inaccuracy so player can dodge
    dir.x += (Math.random() - 0.5) * 0.08;
    dir.y += (Math.random() - 0.5) * 0.05;
    dir.z += (Math.random() - 0.5) * 0.08;
    dir.normalize();

    // Create glowing plasma projectile sphere
    const plasmaGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const plasmaMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaMesh.position.copy(spawnPos);
    this.scene.add(plasmaMesh);

    this.projectiles.push({
      mesh: plasmaMesh,
      position: spawnPos,
      velocity: dir.multiplyScalar(22), // 22 m/s travel speed
      life: 3.0,
      damage: 15
    });
  }

  updateProjectiles(dt, player, shootables) {
    const playerPos = player.camera.position;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);

      // Check hit with player
      const distToPlayer = p.mesh.position.distanceTo(playerPos);
      if (distToPlayer < 1.2) {
        player.takeDamage(p.damage, this.group.position);
        this.particles.createHitSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 'metal');
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check hit with world structures
      for (const obj of shootables) {
        if (!obj.body || obj.body.mass > 0) continue; // Static walls
        const meshBox = new THREE.Box3().setFromObject(obj.mesh);
        if (meshBox.containsPoint(p.mesh.position)) {
          this.particles.createHitSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 'metal');
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  hasLineOfSight(targetPos, shootables) {
    const origin = this.group.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    const dir = targetPos.clone().sub(origin);
    const dist = dir.length();
    dir.normalize();

    const raycaster = new THREE.Raycaster(origin, dir, 0.5, dist);
    const wallMeshes = shootables.map(s => s.mesh).filter(m => !!m);
    const hits = raycaster.intersectObjects(wallMeshes, false);

    return hits.length === 0;
  }

  update(dt, player, shootables) {
    if (!this.isAlive) {
      this.updateProjectiles(dt, player, shootables);
      return;
    }

    this.timeSinceLastShot += dt;

    // Sync group with physics body
    this.group.position.set(
      this.body.position.x,
      this.body.position.y - 0.8,
      this.body.position.z
    );

    const playerPos = player.camera.position.clone();
    const myPos = this.group.position.clone();
    const distToPlayer = myPos.distanceTo(playerPos);

    const hasLOS = (distToPlayer < this.attackRange) && this.hasLineOfSight(playerPos, shootables);

    // FSM State transitions
    if (hasLOS) {
      this.state = distToPlayer < 12 ? 'ATTACK' : 'CHASE';
    } else if (distToPlayer > 35 && this.state !== 'PATROL') {
      this.state = 'PATROL';
    }

    let targetMovePos = null;

    if (this.state === 'PATROL') {
      if (this.waypoints.length > 0) {
        const wp = this.waypoints[this.currentWaypointIdx];
        targetMovePos = new THREE.Vector3(wp.x, myPos.y, wp.z);
        if (myPos.distanceTo(targetMovePos) < 2.0) {
          this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.waypoints.length;
        }
      }
    } else if (this.state === 'CHASE') {
      targetMovePos = playerPos.clone();
      // Rotate to face player
      this.group.lookAt(playerPos.x, myPos.y, playerPos.z);
      if (hasLOS) {
        this.shootAt(playerPos);
      }
    } else if (this.state === 'ATTACK') {
      // Face player & strafe slightly to dodge
      this.group.lookAt(playerPos.x, myPos.y, playerPos.z);
      this.shootAt(playerPos);

      // Keep distance, strafe side to side
      const awayDir = myPos.clone().sub(playerPos).normalize();
      const strafeDir = new THREE.Vector3(-awayDir.z, 0, awayDir.x).multiplyScalar(Math.sin(performance.now() * 0.003));
      targetMovePos = myPos.clone().add(strafeDir.multiplyScalar(3));
    }

    // Apply movement towards target
    if (targetMovePos) {
      const moveDir = targetMovePos.clone().sub(myPos);
      moveDir.y = 0;
      if (moveDir.lengthSq() > 0.2) {
        moveDir.normalize();
        this.body.velocity.x = moveDir.x * this.speed;
        this.body.velocity.z = moveDir.z * this.speed;
        if (this.state === 'PATROL') {
          this.group.rotation.y = Math.atan2(moveDir.x, moveDir.z);
        }
      }
    }

    // Floating bobbing effect for sci-fi hover drone
    this.torso.position.y = 0.9 + Math.sin(performance.now() * 0.005 + myPos.x) * 0.08;

    // Update projectiles
    this.updateProjectiles(dt, player, shootables);
  }

  cleanup() {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];
  }
}
