// The room count is supplied by the owner. Room sizes and partitions are
// illustrative until a measured plan is available. Front = +Z; backyard = -Z.
export const RESIDENCE_ROOMS = {
  ground: [
    { name: 'Sala', x: 0, z: 1.45, width: 4.95, depth: 4.8, color: '#d6c6ad' },
    { name: 'Cozinha', x: 0, z: -3.65, width: 4.95, depth: 4.85, color: '#bccbbd' },
  ],
  upper: [
    { name: 'Quarto 1', x: -.6, z: 2.28, width: 3.7, depth: 3.1, color: '#b9caba' },
    { name: 'Quarto 2', x: -.6, z: -.98, width: 3.7, depth: 3.0, color: '#b8c8d0' },
    { name: 'Quarto 3', x: -.6, z: -4.2, width: 3.7, depth: 3.0, color: '#d6bca6' },
  ],
}
