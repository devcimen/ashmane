import * as THREE from 'three';
import { mulberry32 } from '../core/random';
import type { Look } from './look';

const GROUND_SIZE = 160;
const TEXTURE_SIZE = 256;
const TEXTURE_REPEAT = 14;

/** Large ground plane with a grey blotch texture that gives the dither something to chew on. */
export class GroundView {
  readonly object: THREE.Mesh;
  private readonly material: THREE.MeshLambertMaterial;

  constructor(look: Look) {
    const texture = new THREE.CanvasTexture(createNoiseCanvas());
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);

    this.material = new THREE.MeshLambertMaterial({ map: texture });
    this.object = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), this.material);
    this.object.rotation.x = -Math.PI / 2;
    this.applyLook(look);
  }

  applyLook(look: Look): void {
    this.material.color.setHex(look.ground);
  }
}

function createNoiseCanvas(): HTMLCanvasElement {
  const rng = mulberry32(99);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 700; i++) {
    const g = Math.floor(60 + rng() * 130);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.beginPath();
    ctx.ellipse(rng() * TEXTURE_SIZE, rng() * TEXTURE_SIZE, 2 + rng() * 9, 1 + rng() * 5, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}
