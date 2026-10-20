import * as THREE from 'three';
import { mulberry32 } from '../core/random';
import type { Horse } from '../sim/Horse';

const PINK = 0xffa3d4;
const MANE = 0xe6e6e6;
const HOOF = 0x777777;
const MODEL_SCALE = 0.7;

/** Leg cycle advance per unit travelled (radians). */
const STRIDE_PER_UNIT = 1.4;
/** Speed at which the legs reach their full swing. */
const FULL_SWING_SPEED = 4;
const HIP_SWING = 0.75;
const KNEE_BEND = 1.2;
const BOB_HEIGHT = 0.09;
/** Head nod amplitude at full swing (radians). */
const HEAD_NOD = 0.08;
/** Lean per (turn rate × speed), and its limit (radians). */
const LEAN_FACTOR = 0.012;
const LEAN_MAX = 0.18;
/** How quickly the lean follows the turn (1/s). */
const LEAN_RESPONSE = 8;

const TAIL_STRANDS = 10;
/** Segment lengths of one strand, root to tip; each strand varies them a little. */
const TAIL_SEGMENTS = [0.35, 0.32, 0.2];
/** How far the tail lifts and streams back at full gallop (radians). */
const TAIL_LIFT = 0.2;
/** Side-to-side swish when standing (radians) and its speed (1/s). */
const TAIL_SWISH = 0.18;
const TAIL_SWISH_SPEED = 1.2;
/** Wave travelling down each strand (radians per segment). */
const TAIL_WAVE = 0.12;

/** While taking damage, the horse flashes white and hops this often (seconds). */
const HURT_PULSE = 0.6;
/** How long a white flash takes to fade (seconds). */
const FLASH_DURATION = 0.15;
const HOP_HEIGHT = 0.35;
const HOP_DURATION = 0.3;
const WHITE = new THREE.Color(0xffffff);

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  /** Phase offset in the leg cycle. */
  offset: number;
}

interface TailStrand {
  /** Joint groups from root to tip; each one carries the next. */
  joints: THREE.Group[];
  /** Rest bend of each joint around Z, so the hair falls in a curve. */
  bend: number[];
  /** Phase offset so the strands do not move in lockstep. */
  offset: number;
}

/** Low-poly horse from the look prototype, animated from the horse's speed and turning. */
export class HorseView {
  readonly object = new THREE.Group();
  /** Inner group that leans into turns around the forward axis. */
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legs: Leg[] = [];
  private readonly tail = new THREE.Group();
  private readonly tailStrands: TailStrand[] = [];
  private readonly light = new THREE.PointLight(0xffffff, 0.5 * Math.PI, 9, 1.5);
  private readonly pink = new THREE.MeshLambertMaterial({ color: PINK });

  private phase = 0;
  private lean = 0;
  private time = 0;
  private lastHeading: number | null = null;
  /** Seconds until the next hurt pulse may fire; <= 0 means ready. */
  private hurtCooldown = 0;
  private flash = 0;
  /** Seconds since the last hop started; >= HOP_DURATION means not hopping. */
  private hopTime = HOP_DURATION;

  constructor() {
    const pink = this.pink;
    const mane = new THREE.MeshLambertMaterial({ color: MANE });
    const hoof = new THREE.MeshLambertMaterial({ color: HOOF });

    this.buildBody(pink);
    this.buildHead(pink, mane);
    this.buildLegs(pink, hoof);
    this.buildTail(mane);

    this.body.scale.setScalar(MODEL_SCALE);
    this.object.add(this.body);
    this.light.position.y = 4;
    this.object.add(this.light);
  }

  /** Forgets the previous run so the first frame of a new one does not lean or jump. */
  reset(): void {
    this.lean = 0;
    this.lastHeading = null;
    this.hurtCooldown = 0;
    this.flash = 0;
    this.hopTime = HOP_DURATION;
    this.pink.color.setHex(PINK);
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
    this.time += dt;
    this.updateTail(swing);
    const hop = this.updateHurt(horse.lastDamage > 0, dt);

    this.object.position.set(horse.x, Math.abs(Math.sin(this.phase)) * BOB_HEIGHT * swing + hop, horse.z);
    this.object.rotation.y = horse.heading;
  }

  /**
   * While the horse takes damage it pulses: a short white flash and a small startled hop,
   * repeated every HURT_PULSE seconds. Returns the current hop height.
   */
  private updateHurt(hurting: boolean, dt: number): number {
    this.hurtCooldown -= dt;
    if (hurting && this.hurtCooldown <= 0) {
      this.hurtCooldown = HURT_PULSE;
      this.flash = 1;
      this.hopTime = 0;
    }
    this.flash = Math.max(0, this.flash - dt / FLASH_DURATION);
    this.pink.color.setHex(PINK).lerp(WHITE, this.flash);

    this.hopTime += dt;
    if (this.hopTime >= HOP_DURATION) return 0;
    return Math.sin((this.hopTime / HOP_DURATION) * Math.PI) * HOP_HEIGHT;
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

  /** Swishes gently when standing; lifts and streams back with a ripple when running. */
  private updateTail(swing: number): void {
    const idle = 1 - swing;
    this.tail.rotation.z = -TAIL_LIFT * swing;
    this.tail.rotation.x = Math.sin(this.time * TAIL_SWISH_SPEED) * TAIL_SWISH * idle;
    // The ripple follows the leg cycle when running and slow time when standing.
    const clock = this.phase * 2 * swing + this.time * TAIL_SWISH_SPEED * idle;
    for (const strand of this.tailStrands) {
      strand.joints.forEach((joint, i) => {
        const wave = Math.sin(clock - i * 0.8 + strand.offset) * TAIL_WAVE * (i + 1);
        joint.rotation.z = strand.bend[i] * (1 - 0.6 * swing) + wave * (0.4 + swing);
        joint.rotation.x = wave * 0.5;
      });
    }
  }

  // Model coordinates: +X is forward (head), +Y is up. Values from the look prototype.

  private buildBody(pink: THREE.Material): void {
    this.body.add(part(sphere(), pink, [0, 1.4, 0], [1.05, 0.52, 0.42]));
    this.body.add(part(sphere(), pink, [0.6, 1.42, 0], [0.55, 0.56, 0.42]));
    this.body.add(part(sphere(), pink, [-0.65, 1.45, 0], [0.55, 0.56, 0.43]));
  }

  /**
   * A bundle of thin tapered strands hanging from the dock. Each strand is a chain of
   * jointed segments that fan out a little and curve down like falling hair.
   */
  private buildTail(mane: THREE.Material): void {
    const rng = mulberry32(3);
    this.tail.position.set(-1.12, 1.62, 0);
    this.tail.add(part(sphere(), mane, [0, 0, 0], [0.17, 0.14, 0.16]));

    for (let s = 0; s < TAIL_STRANDS; s++) {
      const length = 1.0 + rng() * 0.35;
      const root = new THREE.Group();
      // Tilt back (negative Z) and fan out sideways (X) around the dock.
      root.rotation.set((s / (TAIL_STRANDS - 1) - 0.5) * 0.5 + (rng() - 0.5) * 0.1, 0, -0.7 - rng() * 0.25);
      this.tail.add(root);

      const joints: THREE.Group[] = [];
      const bend: number[] = [];
      let parent: THREE.Object3D = root;
      let radius = 0.045 + rng() * 0.02;
      TAIL_SEGMENTS.forEach((baseLength, i) => {
        const segLength = baseLength * length;
        const tip = i === TAIL_SEGMENTS.length - 1 ? 0.006 : radius * 0.7;
        const geometry = new THREE.CylinderGeometry(radius, tip, segLength, 5);
        geometry.translate(0, -segLength / 2, 0); // hang down from the joint

        const joint = new THREE.Group();
        if (i > 0) joint.position.y = -TAIL_SEGMENTS[i - 1] * length;
        joint.add(new THREE.Mesh(geometry, mane));
        parent.add(joint);

        joints.push(joint);
        bend.push(i === 0 ? 0 : 0.22 + rng() * 0.1); // later segments curve towards vertical
        parent = joint;
        radius = tip;
      });
      this.tailStrands.push({ joints, bend, offset: rng() * Math.PI * 2 });
    }
    this.body.add(this.tail);
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
