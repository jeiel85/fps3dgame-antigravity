import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.sparks = [];
    this.shockwaves = [];
    this.tracers = [];
    this.casings = [];

    // Reusable geometries and materials
    this.sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    this.sparkMatYellow = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
    this.sparkMatCyan = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    this.sparkMatRed = new THREE.MeshBasicMaterial({ color: 0xff3322 });

    // Shell casing geo & mat
    this.casingGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.05, 6);
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.8,
      roughness: 0.2
    });
  }

  // Create hit spark effect (at contact normal)
  createHitSparks(position, normal, type = 'metal') {
    const count = type === 'bot' ? 12 : 8;
    const mat = type === 'bot' ? this.sparkMatCyan : this.sparkMatYellow;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(position);

      // Random velocity biased along the surface normal
      const spread = 0.8;
      const vx = normal.x + (Math.random() - 0.5) * spread;
      const vy = normal.y + (Math.random() - 0.5) * spread + 0.3;
      const vz = normal.z + (Math.random() - 0.5) * spread;
      const speed = 4 + Math.random() * 5;

      const velocity = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);

      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        velocity,
        gravity: -15,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6
      });
    }
  }

  // Create bullet tracer beam
  createTracer(from, to, color = 0xffff55) {
    const distance = from.distanceTo(to);
    const geom = new THREE.CylinderGeometry(0.015, 0.015, distance, 4);
    geom.rotateX(Math.PI / 2); // align along Z
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geom, mat);

    // Position at midpoint and orient towards target
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);

    this.scene.add(mesh);
    this.tracers.push({
      mesh,
      mat,
      life: 0.12,
      maxLife: 0.12
    });
  }

  // Create ejected shell casing
  createShellCasing(position, rightVector) {
    const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
    mesh.position.copy(position);

    // Velocity to the right and slightly up/back
    const velocity = new THREE.Vector3()
      .copy(rightVector)
      .multiplyScalar(2.5 + Math.random())
      .add(new THREE.Vector3(0, 1.8 + Math.random(), 0));

    const rotSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    );

    this.scene.add(mesh);
    this.casings.push({
      mesh,
      velocity,
      rotSpeed,
      life: 1.5
    });
  }

  // Create explosion effect with expanding fireball and shockwave ring
  createExplosion(position, radius = 5) {
    // 1. Fireball sphere
    const sphereGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.9
    });
    const fireball = new THREE.Mesh(sphereGeo, sphereMat);
    fireball.position.copy(position);
    this.scene.add(fireball);

    // 2. Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.2, 0.8, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const shockwave = new THREE.Mesh(ringGeo, ringMat);
    shockwave.position.copy(position);
    shockwave.position.y += 0.1;
    this.scene.add(shockwave);

    this.shockwaves.push({
      fireball,
      sphereMat,
      shockwave,
      ringMat,
      scale: 0.5,
      targetRadius: radius,
      life: 0.5,
      maxLife: 0.5
    });

    // 3. Debris sparks
    for (let i = 0; i < 25; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, Math.random() > 0.4 ? this.sparkMatRed : this.sparkMatYellow);
      mesh.position.copy(position);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.5,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(8 + Math.random() * 10);

      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        velocity: vel,
        gravity: -20,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2
      });
    }

    // Dynamic light flash
    const light = new THREE.PointLight(0xff5500, 6, radius * 3);
    light.position.copy(position);
    this.scene.add(light);
    setTimeout(() => {
      this.scene.remove(light);
    }, 200);
  }

  update(dt) {
    // 1. Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      p.velocity.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      const progress = p.life / p.maxLife;
      p.mesh.scale.setScalar(progress);
    }

    // 2. Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
        continue;
      }
      t.mat.opacity = (t.life / t.maxLife) * 0.9;
    }

    // 3. Update shell casings
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.casings.splice(i, 1);
        continue;
      }
      c.velocity.y -= 18 * dt;
      c.mesh.position.addScaledVector(c.velocity, dt);
      c.mesh.rotation.x += c.rotSpeed.x * dt;
      c.mesh.rotation.y += c.rotSpeed.y * dt;
      c.mesh.rotation.z += c.rotSpeed.z * dt;

      // Floor bounce clamp
      if (c.mesh.position.y < 0.05) {
        c.mesh.position.y = 0.05;
        c.velocity.y = -c.velocity.y * 0.4;
        c.velocity.x *= 0.6;
        c.velocity.z *= 0.6;
      }
    }

    // 4. Update shockwaves & explosions
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const exp = this.shockwaves[i];
      exp.life -= dt;
      if (exp.life <= 0) {
        this.scene.remove(exp.fireball);
        this.scene.remove(exp.shockwave);
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = 1 - (exp.life / exp.maxLife);
      const scale = 0.5 + progress * (exp.targetRadius * 1.5);
      exp.fireball.scale.setScalar(scale);
      exp.shockwave.scale.setScalar(scale * 1.8);
      exp.sphereMat.opacity = (1 - progress) * 0.9;
      exp.ringMat.opacity = (1 - progress) * 0.8;
    }
  }
}
