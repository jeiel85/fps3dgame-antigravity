import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -25, 0); // Fast, satisfying FPS gravity
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false; // Never freeze player or moving physics bodies

    // Contact Materials
    this.groundMaterial = new CANNON.Material('ground');
    this.playerMaterial = new CANNON.Material('player');
    this.objectMaterial = new CANNON.Material('object');

    // Player vs Ground (slight friction, no bounciness)
    const playerGroundContact = new CANNON.ContactMaterial(
      this.playerMaterial,
      this.groundMaterial,
      {
        friction: 0.0,
        restitution: 0.0
      }
    );
    this.world.addContactMaterial(playerGroundContact);

    // Objects vs Ground (bouncy, friction)
    const objectGroundContact = new CANNON.ContactMaterial(
      this.objectMaterial,
      this.groundMaterial,
      {
        friction: 0.4,
        restitution: 0.3
      }
    );
    this.world.addContactMaterial(objectGroundContact);

    // Objects vs Objects
    const objectObjectContact = new CANNON.ContactMaterial(
      this.objectMaterial,
      this.objectMaterial,
      {
        friction: 0.5,
        restitution: 0.25
      }
    );
    this.world.addContactMaterial(objectObjectContact);

    // Dynamic bodies tracked for syncing with Three.js meshes
    this.dynamicBodies = [];
  }

  registerDynamicBody(mesh, body, customSync = null) {
    this.world.addBody(body);
    this.dynamicBodies.push({ mesh, body, customSync });
  }

  removeDynamicBody(body) {
    const idx = this.dynamicBodies.findIndex(item => item.body === body);
    if (idx !== -1) {
      this.dynamicBodies.splice(idx, 1);
    }
    this.world.removeBody(body);
  }

  step(dt) {
    // Fixed time step for rock-solid stability
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 3;
    this.world.step(fixedTimeStep, dt, maxSubSteps);

    // Synchronize Three.js visual meshes with Cannon-es physics bodies
    for (const item of this.dynamicBodies) {
      if (item.customSync) {
        item.customSync(item.mesh, item.body);
      } else if (item.mesh && item.body) {
        item.mesh.position.copy(item.body.position);
        item.mesh.quaternion.copy(item.body.quaternion);
      }
    }
  }

  // Radial explosive impulse helper
  applyExplosionImpulse(epicenter, radius, force) {
    for (const item of this.dynamicBodies) {
      const body = item.body;
      if (body.mass === 0) continue; // Skip static objects

      const dist = body.position.distanceTo(epicenter);
      if (dist < radius) {
        const factor = 1 - (dist / radius);
        const impulse = new CANNON.Vec3();
        body.position.vsub(epicenter, impulse);
        if (impulse.length() < 0.001) {
          impulse.set(0, 1, 0);
        } else {
          impulse.normalize();
        }

        // Add upward lift for cinematic explosion effect
        impulse.y += 0.5;
        impulse.normalize();

        const strength = force * factor;
        impulse.scale(strength, impulse);
        body.applyImpulse(impulse, body.position);
        body.wakeUp();
      }
    }
  }
}
