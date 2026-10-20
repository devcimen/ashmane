import * as THREE from 'three';
import { mulberry32 } from '../core/random';
import { WORLD_HALF } from '../sim/world';

/** Reaches well past the world so the horizon never shows an edge. */
const GROUND_SIZE = WORLD_HALF * 2 + 100;
const GROUND_COLOR = 0x6a6a6a;
const TEXTURE_SIZE = 256;
/** World units covered by one texture tile. */
const TEXTURE_TILE = 11.5;

/** Large ground plane with a grey blotch texture that gives the dither something to chew on. */
export class GroundView {
  readonly object: THREE.Mesh;

  constructor() {
    const texture = new THREE.CanvasTexture(createNoiseCanvas());
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(GROUND_SIZE / TEXTURE_TILE, GROUND_SIZE / TEXTURE_TILE);

    this.object = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshLambertMaterial({ color: GROUND_COLOR, map: texture }),
    );
    this.object.rotation.x = -Math.PI / 2;
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
