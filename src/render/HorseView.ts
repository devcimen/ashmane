import * as THREE from 'three';
import type { Horse } from '../sim/Horse';

const PINK = 0xffa3d4;
const MANE = 0xe6e6e6;
const HOOF = 0x777777;
const MODEL_SCALE = 1.25;

/** Leg cycle advance per unit travelled (radians). */
const STRIDE_PER_UNIT = 2.2;
/** Speed at which the legs reach their full swing. */
const FULL_SWING_SPEED = 2.5;
const HIP_SWING = 0.75;
const KNEE_BEND = 0.9;
const BOB_HEIGHT = 0.09;
/** Head nod amplitude at full swing (radians). */
const HEAD_NOD = 0.07;
/** Lean per (turn rate × speed), and its limit (radians). */
const LEAN_FACTOR = 0.012;
const LEAN_MAX = 0.18;
/** How quickly the lean follows the turn (1/s). */
const LEAN_RESPONSE = 8;

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  /** Phase offset in the leg cycle. */
  offset: number;
}

/** Low-poly horse from the look prototype, animated from the horse's speed and turning. */
export class HorseView {
  readonly object = new THREE.Group();
  /** Inner group that leans into turns around the forward axis. */
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legs: Leg[] = [];
  private readonly light = new THREE.PointLight(0xffffff, 0.5 * Math.PI, 9, 1.5);

  private phase = 0;
  private lean = 0;
  private lastHeading: number | null = null;

  constructor() {
    const pink = new THREE.MeshLambertMaterial({ color: PINK });
    const mane = new THREE.MeshLambertMaterial({ color: MANE });
    const hoof = new THREE.MeshLambertMaterial({ color: HOOF });

    this.buildBody(pink, mane);
    this.buildHead(pink, mane);
    this.buildLegs(pink, hoof);

    this.body.scale.setScalar(MODEL_SCALE);
    this.object.add(this.body);
    this.light.position.y = 4;
    this.object.add(this.light);
  }

  update(horse: Horse, dt: number): void {
    const swing = Math.min(1, horse.speed / FULL_SWING_SPEED);
    this.phase += horse.speed * STRIDE_PER_UNIT * dt;

    for (const leg of this.legs) {
      const p = this.phase + leg.offset;
      leg.hip.rotation.z = Math.sin(p) * HIP_SWING * swing;
      leg.knee.rotation.z = -Math.max(0, Math.cos(p)) * KNEE_BEND * swing;
    }
    this.head.rotation.z = Math.sin(this.phase * 2) * HEAD_NOD * swing;

    this.updateLean(horse, dt);

    this.object.position.set(horse.x, Math.abs(Math.sin(this.phase)) * BOB_HEIGHT * swing, horse.z);
    this.object.rotation.y = horse.heading;
  }

  /** Leans into the curve: stronger the faster the horse turns and runs. */
  private updateLean(horse: Horse, dt: number): void {
    let turnRate = 0;
    if (this.lastHeading !== null && dt > 0) {
      const d = horse.heading - this.lastHeading;
      turnRate = Math.atan2(Math.sin(d), Math.cos(d)) / dt;
    }
    this.lastHeading = horse.heading;
    // Positive turn rate = left turn; leaning left tilts the top towards local -Z.
    const target = THREE.MathUtils.clamp(-turnRate * horse.speed * LEAN_FACTOR, -LEAN_MAX, LEAN_MAX);
    this.lean += (target - this.lean) * (1 - Math.exp(-LEAN_RESPONSE * dt));
    this.body.rotation.x = this.lean;
  }

  // Model coordinates: +X is forward (head), +Y is up. Values from the look prototype.

  private buildBody(pink: THREE.Material, mane: THREE.Material): void {
    this.body.add(part(sphere(), pink, [0, 1.4, 0], [1.05, 0.52, 0.42]));
    this.body.add(part(sphere(), pink, [0.6, 1.42, 0], [0.55, 0.56, 0.42]));
    this.body.add(part(sphere(), pink, [-0.65, 1.45, 0], [0.55, 0.56, 0.43]));
    const tail = part(new THREE.CylinderGeometry(0.05, 0.16, 1.0, 6), mane, [-1.52, 1.16, 0]);
    tail.rotation.z = 2.3;
    this.body.add(tail);
  }

  /** Neck, head, ears and mane hang from a pivot at the base of the neck so they can nod. */
  private buildHead(pink: THREE.Material, mane: THREE.Material): void {
    const pivot = new THREE.Vector3(0.75, 1.7, 0);
    this.head.position.copy(pivot);
    const add = (mesh: THREE.Mesh) => {
      mesh.position.sub(pivot);
      this.head.add(mesh);
    };

    const neck = part(new THREE.CylinderGeometry(0.17, 0.3, 1.1, 10), pink, [0.98, 2.0, 0]);
    neck.rotation.z = -0.65;
    add(neck);
    const skull = part(sphere(), pink, [1.5, 2.45, 0], [0.45, 0.27, 0.25]);
    skull.rotation.z = -0.45;
    add(skull);
    const muzzle = part(new THREE.CylinderGeometry(0.12, 0.17, 0.45, 8), pink, [1.85, 2.28, 0]);
    muzzle.rotation.z = -1.25;
    add(muzzle);
    for (const z of [0.1, -0.1]) add(part(new THREE.ConeGeometry(0.07, 0.25, 5), pink, [1.3, 2.75, z]));
    for (const [x, y] of [[0.62, 1.95], [0.8, 2.25], [0.98, 2.5], [1.15, 2.7]]) {
      const tuft = part(new THREE.ConeGeometry(0.11, 0.45, 4), mane, [x, y, 0]);
      tuft.rotation.z = 0.55;
      add(tuft);
    }
    this.body.add(this.head);
  }

  /** Each leg has a hip and a knee joint; diagonal pairs move together. */
  private buildLegs(pink: THREE.Material, hoof: THREE.Material): void {
    const layout: [x: number, z: number, offset: number][] = [
      [0.65, 0.22, 0],
      [0.65, -0.22, Math.PI],
      [-0.7, 0.22, Math.PI],
      [-0.7, -0.22, 0],
    ];
    for (const [x, z, offset] of layout) {
      const hip = new THREE.Group();
      hip.position.set(x, 1.15, z);
      hip.add(part(new THREE.CylinderGeometry(0.16, 0.11, 0.6, 8), pink, [0, -0.3, 0]));
      const knee = new THREE.Group();
      knee.position.set(0, -0.6, 0);
      knee.add(part(new THREE.CylinderGeometry(0.1, 0.075, 0.6, 8), pink, [0, -0.3, 0]));
      knee.add(part(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 8), hoof, [0, -0.64, 0]));
      hip.add(knee);
      this.body.add(hip);
      this.legs.push({ hip, knee, offset });
    }
  }
}

function sphere(): THREE.SphereGeometry {
  return new THREE.SphereGeometry(1, 16, 12);
}

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  [x, y, z]: [number, number, number],
  scale?: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (scale) mesh.scale.set(...scale);
  return mesh;
}
