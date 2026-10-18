import * as THREE from 'three';
import type { Horse } from '../sim/Horse';

const PINK = 0xffa3d4;

/** Placeholder horse: a pink box with a small light that keeps it readable in the dark. */
export class HorseView {
  readonly object = new THREE.Group();
  private readonly light = new THREE.PointLight(0xffffff, 0.5 * Math.PI, 9, 1.5);

  constructor() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.9), new THREE.MeshLambertMaterial({ color: PINK }));
    body.position.y = 1.2;
    this.object.add(body);
    this.light.position.y = 4;
    this.object.add(this.light);
  }

  update(horse: Horse): void {
    this.object.position.set(horse.x, 0, horse.z);
    this.object.rotation.y = horse.heading;
  }
}
