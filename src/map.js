import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sound } from './audio.js';

export class ArenaMap {
  constructor(scene, physicsWorld, particleSystem) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.particles = particleSystem;

    this.shootables = []; // List of objects for raycast weapon hit detection
    this.jumpPads = [];
    this.explosiveBarrels = [];

    this.initMap();
  }

  initMap() {
    this.createFloor();
    this.createPerimeterWalls();
    this.createStructures();
    this.createJumpPads();
    this.createPhysicsCrates();
    this.createExplosiveBarrels();
    this.setupLighting();
  }

  // Procedural grid texture for sci-fi floor
  createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, 512, 512);

    // Inner subtle grid
    ctx.strokeStyle = '#162235';
    ctx.lineWidth = 2;
    const step = 32;
    for (let x = 0; x <= 512; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(512, x);
      ctx.stroke();
    }

    // Bold border
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 508);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
  }

  createFloor() {
    const size = 70;
    const floorGeo = new THREE.PlaneGeometry(size, size);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createGridTexture(),
      roughness: 0.7,
      metalness: 0.3
    });

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Cannon-es static ground plane
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.physicsWorld.groundMaterial
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physicsWorld.world.addBody(groundBody);

    this.shootables.push({ mesh: floorMesh, body: groundBody });
  }

  createPerimeterWalls() {
    const size = 70;
    const height = 8;
    const thickness = 2;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.5,
      metalness: 0.5
    });
    const neonLineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    const wallConfigs = [
      { x: 0, z: -size / 2, w: size, d: thickness },
      { x: 0, z: size / 2, w: size, d: thickness },
      { x: -size / 2, z: 0, w: thickness, d: size },
      { x: size / 2, z: 0, w: thickness, d: size }
    ];

    wallConfigs.forEach(cfg => {
      const geo = new THREE.BoxGeometry(cfg.w, height, cfg.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(cfg.x, height / 2, cfg.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Neon trim at top
      const trimGeo = new THREE.BoxGeometry(cfg.w, 0.15, cfg.d);
      const trimMesh = new THREE.Mesh(trimGeo, neonLineMat);
      trimMesh.position.set(cfg.x, height - 0.2, cfg.z);
      this.scene.add(trimMesh);

      // Physics body
      const shape = new CANNON.Box(new CANNON.Vec3(cfg.w / 2, height / 2, cfg.d / 2));
      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape,
        material: this.physicsWorld.groundMaterial,
        position: new CANNON.Vec3(cfg.x, height / 2, cfg.z)
      });
      this.physicsWorld.world.addBody(body);
      this.shootables.push({ mesh, body });
    });
  }

  // Create elevated platforms, pillars, and tactical covers
  createStructures() {
    const structMat = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      roughness: 0.6,
      metalness: 0.4
    });

    const structures = [
      // Central high bridge
      { x: 0, y: 1.5, z: 0, w: 12, h: 3, d: 12 },
      // Ramps to central bridge
      { x: 0, y: 0.75, z: -8.5, w: 6, h: 1.5, d: 5, rotX: 0.25 },
      { x: 0, y: 0.75, z: 8.5, w: 6, h: 1.5, d: 5, rotX: -0.25 },

      // Flank covers
      { x: -15, y: 1.25, z: -10, w: 6, h: 2.5, d: 1.5 },
      { x: 15, y: 1.25, z: -10, w: 6, h: 2.5, d: 1.5 },
      { x: -15, y: 1.25, z: 10, w: 6, h: 2.5, d: 1.5 },
      { x: 15, y: 1.25, z: 10, w: 6, h: 2.5, d: 1.5 },

      // Corner towers
      { x: -22, y: 2.5, z: -22, w: 7, h: 5, d: 7 },
      { x: 22, y: 2.5, z: -22, w: 7, h: 5, d: 7 },
      { x: -22, y: 2.5, z: 22, w: 7, h: 5, d: 7 },
      { x: 22, y: 2.5, z: 22, w: 7, h: 5, d: 7 },

      // Mid-field tactical blocks
      { x: -8, y: 1, z: 15, w: 3, h: 2, d: 3 },
      { x: 8, y: 1, z: -15, w: 3, h: 2, d: 3 },
      { x: -18, y: 1, z: 0, w: 2, h: 2, d: 8 },
      { x: 18, y: 1, z: 0, w: 2, h: 2, d: 8 }
    ];

    structures.forEach(s => {
      const geo = new THREE.BoxGeometry(s.w, s.h, s.d);
      const mesh = new THREE.Mesh(geo, structMat);
      mesh.position.set(s.x, s.y, s.z);
      if (s.rotX) mesh.rotation.x = s.rotX;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Physics body
      const shape = new CANNON.Box(new CANNON.Vec3(s.w / 2, s.h / 2, s.d / 2));
      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape,
        material: this.physicsWorld.groundMaterial,
        position: new CANNON.Vec3(s.x, s.y, s.z)
      });
      if (s.rotX) body.quaternion.setFromEuler(s.rotX, 0, 0);

      this.physicsWorld.world.addBody(body);
      this.shootables.push({ mesh, body });
    });
  }

  // Jump Pads that boost the player or objects upward into the air
  createJumpPads() {
    const padLocations = [
      { x: -12, z: 0 },
      { x: 12, z: 0 }
    ];

    padLocations.forEach(loc => {
      // 3D Visual Pad
      const baseGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.2, 16);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
      const padMesh = new THREE.Mesh(baseGeo, baseMat);
      padMesh.position.set(loc.x, 0.1, loc.z);
      this.scene.add(padMesh);

      // Glowing center core
      const coreGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.22, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(loc.x, 0.12, loc.z);
      this.scene.add(coreMesh);

      // Point Light above pad
      const light = new THREE.PointLight(0x00ff88, 2, 6);
      light.position.set(loc.x, 0.8, loc.z);
      this.scene.add(light);

      this.jumpPads.push({
        position: new THREE.Vector3(loc.x, 0.2, loc.z),
        radius: 1.6,
        force: 17,
        cooldown: 0
      });
    });
  }

  // Dynamic rigid-body crates that can be kicked, pushed, and shot
  createPhysicsCrates() {
    const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x966f33,
      metalness: 0.1,
      roughness: 0.8
    });

    const positions = [
      // Crate stacks
      { x: -5, y: 0.6, z: 6 },
      { x: -5, y: 1.8, z: 6 },
      { x: -6.2, y: 0.6, z: 6 },

      { x: 6, y: 0.6, z: -6 },
      { x: 6, y: 1.8, z: -6 },
      { x: 7.2, y: 0.6, z: -6 },

      // Upper platform crates
      { x: -3, y: 3.6, z: 2 },
      { x: 3, y: 3.6, z: -2 },

      // Scattered around arena
      { x: 10, y: 0.6, z: 12 },
      { x: -10, y: 0.6, z: -12 },
      { x: -12, y: 0.6, z: 14 },
      { x: 12, y: 0.6, z: -14 }
    ];

    positions.forEach(pos => {
      const mesh = new THREE.Mesh(crateGeo, crateMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(0.6, 0.6, 0.6));
      const body = new CANNON.Body({
        mass: 8, // Realistic physics mass
        shape,
        material: this.physicsWorld.objectMaterial,
        position: new CANNON.Vec3(pos.x, pos.y, pos.z)
      });
      // Small random rotation for natural look
      body.quaternion.setFromEuler(0, (Math.random() - 0.5) * 0.4, 0);

      this.physicsWorld.registerDynamicBody(mesh, body);
      this.shootables.push({ mesh, body });
    });
  }

  // Explosive barrels with hazard stripes that detonate when shot
  createExplosiveBarrels() {
    const barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.3, 16);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xcc2211,
      metalness: 0.6,
      roughness: 0.3
    });

    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    const barrelPositions = [
      { x: -4, y: 0.65, z: -4 },
      { x: 4, y: 0.65, z: 4 },
      { x: -16, y: 0.65, z: -16 },
      { x: 16, y: 0.65, z: 16 },
      { x: 0, y: 3.65, z: 0 } // On high central bridge!
    ];

    barrelPositions.forEach(pos => {
      const group = new THREE.Group();

      const mainMesh = new THREE.Mesh(barrelGeo, barrelMat);
      mainMesh.castShadow = true;
      mainMesh.receiveShadow = true;
      group.add(mainMesh);

      // Hazard stripe band
      const stripeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.3, 16), yellowStripeMat);
      group.add(stripeMesh);

      this.scene.add(group);

      const shape = new CANNON.Cylinder(0.55, 0.55, 1.3, 12);
      const body = new CANNON.Body({
        mass: 14,
        shape,
        material: this.physicsWorld.objectMaterial,
        position: new CANNON.Vec3(pos.x, pos.y, pos.z)
      });

      this.physicsWorld.registerDynamicBody(group, body);

      const barrelObj = {
        mesh: mainMesh,
        parentGroup: group,
        body,
        health: 40,
        exploded: false,
        onHit: (dmg, hitPoint) => {
          barrelObj.health -= dmg;
          if (barrelObj.health <= 0 && !barrelObj.exploded) {
            this.explodeBarrel(barrelObj);
          }
        }
      };

      this.explosiveBarrels.push(barrelObj);
      this.shootables.push(barrelObj);
    });
  }

  explodeBarrel(barrel) {
    barrel.exploded = true;
    const pos = new THREE.Vector3(barrel.body.position.x, barrel.body.position.y, barrel.body.position.z);

    // Audio & Particles
    sound.playExplosion();
    this.particles.createExplosion(pos, 7);

    // Physics shockwave to all nearby dynamic bodies
    this.physicsWorld.applyExplosionImpulse(barrel.body.position, 10, 65);

    // Remove mesh and body from scene & physics world
    this.scene.remove(barrel.parentGroup);
    this.physicsWorld.removeDynamicBody(barrel.body);

    const shootIdx = this.shootables.indexOf(barrel);
    if (shootIdx !== -1) this.shootables.splice(shootIdx, 1);

    // Notify listeners (damage player or bots)
    if (this.onBarrelExploded) {
      this.onBarrelExploded(pos, 8, 80);
    }
  }

  setupLighting() {
    // Ambient light with soft futuristic blue tint
    const ambient = new THREE.AmbientLight(0x1a2436, 1.2);
    this.scene.add(ambient);

    // Main directional sunlight with shadows
    const dirLight = new THREE.DirectionalLight(0xddeeff, 2.0);
    dirLight.position.set(30, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 120;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    this.scene.add(dirLight);

    // Atmospheric cyber point lights
    const colors = [0x00ffff, 0xff0066, 0x00ff88, 0xffaa00];
    const positions = [
      [-22, 6, -22],
      [22, 6, -22],
      [-22, 6, 22],
      [22, 6, 22]
    ];
    positions.forEach((p, idx) => {
      const pl = new THREE.PointLight(colors[idx], 3.0, 30);
      pl.position.set(p[0], p[1], p[2]);
      this.scene.add(pl);
    });

    // Fog for deep atmosphere
    this.scene.fog = new THREE.FogExp2(0x060912, 0.018);
  }

  checkJumpPads(playerPos, onBoost) {
    for (const pad of this.jumpPads) {
      if (pad.cooldown > 0) continue;
      const dist = new THREE.Vector2(playerPos.x - pad.position.x, playerPos.z - pad.position.z).length();
      if (dist < pad.radius && Math.abs(playerPos.y - pad.position.y) < 1.0) {
        pad.cooldown = 0.5;
        sound.playJumpPad();
        onBoost(pad.force);
        break;
      }
    }
  }

  update(dt) {
    // Update cooldowns
    for (const pad of this.jumpPads) {
      if (pad.cooldown > 0) pad.cooldown -= dt;
    }
  }
}
