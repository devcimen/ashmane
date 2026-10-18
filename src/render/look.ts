/**
 * Colour settings for ground and trees. The dither pass turns brightness into dot density,
 * so separating trees from ground is purely a matter of brightness contrast.
 *
 * Temporary: three variants to compare live with keys 1–3 (dev only). Once one is chosen,
 * the others get removed and the values move into the views.
 */
export interface Look {
  name: string;
  ground: number;
  leaves: number;
  pineTrunk: number;
  broadleafTrunk: number;
  /** Dark blob under each crown that grounds the tree visually. */
  shadows: boolean;
}

export const LOOKS: Look[] = [
  {
    name: 'A: dark ground, bright trees',
    ground: 0x3c3c3c,
    leaves: 0xc8c8c8,
    pineTrunk: 0x6a6a6a,
    broadleafTrunk: 0x606060,
    shadows: false,
  },
  {
    name: 'B: light ground, dark tree silhouettes',
    ground: 0xb4b4b4,
    leaves: 0x404040,
    pineTrunk: 0x2a2a2a,
    broadleafTrunk: 0x262626,
    shadows: false,
  },
  {
    name: 'C: mid ground, bright trees with shadows',
    ground: 0x6a6a6a,
    leaves: 0xb4b4b4,
    pineTrunk: 0x5a5a5a,
    broadleafTrunk: 0x505050,
    shadows: true,
  },
];
