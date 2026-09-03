import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sound } from './audio.js';

export class Player {
  constructor(camera, domElement, physicsWorld) {
    this.camera = camera;
    this.domElement = domElement;
    this.physicsWorld = physicsWorld;

    // Health & Shield
    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 50;
    this.shield = 50;
    this.isDead = false;
    this.timeSinceDamage = 999;

    // Movement speeds
    this.walkSpeed = 8.5;
    this.sprintSpeed = 14.0;
    this.jumpForce = 10.5;

    // Input States
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    };

    // Camera rotation angles
    this.pitch = 0;
    this.yaw = 0;
    this.isLocked = false;

    // Footstep timer
    this.footstepTimer = 0;

    // Physics Body
    this.initPhysics();
    this.initControls();
  }

  initPhysics() {
    const radius = 0.65;
    const shape = new CANNON.Sphere(radius);
    this.body = new CANNON.Body({
      mass: 70, // 70 kg
      shape,
      material: this.physicsWorld.playerMaterial,
      position: new CANNON.Vec3(0, 3, 20), // Player spawn point
      linearDamping: 0.15,
      fixedRotation: true // Prevent rolling over
    });
    this.body.updateMassProperties();
    this.physicsWorld.world.addBody(this.body);
  }

  initControls() {
    // Pointer Lock
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = (document.pointerLockElement === this.domElement);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked || this.isDead) return;

      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;

      // Clamp vertical pitch to prevent neck snapping
      const maxPitch = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    // Keyboard
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  onKeyDown(e) {
    if (this.isDead) return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
        break;
      case 'Space':
        this.keys.jump = true;
        this.tryJump();
        break;
    }
  }

  onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
        break;
      case 'Space':
        this.keys.jump = false;
        break;
    }
  }

  isGrounded() {
    // Check if player body is resting on a surface
    // Using contact equation normal check or raycast downwards
    return Math.abs(this.body.velocity.y) < 0.25;
  }

  tryJump() {
    if (this.isGrounded()) {
      this.body.velocity.y = this.jumpForce;
    }
  }

  applyBoost(forceY) {
    this.body.velocity.y = forceY;
  }

  takeDamage(amount, sourcePos = null) {
    if (this.isDead) return;

    this.timeSinceDamage = 0;
    sound.playPlayerHurt();

    // Shield absorbs damage first
    if (this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
        amount = 0;
      } else {
        amount -= this.shield;
        this.shield = 0;
      }
    }

    this.health = Math.max(0, this.health - amount);

    if (this.onDamageTaken) {
      this.onDamageTaken(this.health, this.shield, sourcePos);
    }

    if (this.health <= 0) {
      this.isDead = true;
      if (this.onDeath) {
        this.onDeath();
      }
    }
  }

  reset(spawnX = 0, spawnY = 3, spawnZ = 20) {
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.isDead = false;
    this.body.position.set(spawnX, spawnY, spawnZ);
    this.body.velocity.set(0, 0, 0);
  }

  update(dt) {
    if (this.isDead) return;

    this.timeSinceDamage += dt;
    // Shield auto-regeneration after 4 seconds of peace
    if (this.timeSinceDamage > 4.0 && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + dt * 15);
    }

    // 1. Calculate camera orientation
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(euler);

    // 2. Movement vectors
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.yaw, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0));

    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.add(forward);
    if (this.keys.backward) moveDir.sub(forward);
    if (this.keys.right) moveDir.add(right);
    if (this.keys.left) moveDir.sub(right);

    const isMoving = moveDir.lengthSq() > 0.001;
    if (isMoving) moveDir.normalize();

    const speed = this.keys.sprint ? this.sprintSpeed : this.walkSpeed;

    // Apply horizontal velocity to Cannon-es body
    if (isMoving) {
      this.body.velocity.x = moveDir.x * speed;
      this.body.velocity.z = moveDir.z * speed;

      // Footstep sound cadence
      if (this.isGrounded()) {
        this.footstepTimer += dt * (this.keys.sprint ? 1.6 : 1.0);
        if (this.footstepTimer > 0.38) {
          this.footstepTimer = 0;
          sound.playFootstep();
        }
      }
    } else {
      // Snappy deceleration
      this.body.velocity.x *= 0.8;
      this.body.velocity.z *= 0.8;
    }

    // 3. Keep camera at player eye height (body pos + 1.1m)
    this.camera.position.set(
      this.body.position.x,
      this.body.position.y + 1.1,
      this.body.position.z
    );

    // Arena boundary safety fall-catch
    if (this.body.position.y < -10) {
      this.reset(0, 3, 20);
    }

    return {
      isMoving,
      isSprinting: this.keys.sprint
    };
  }
}
