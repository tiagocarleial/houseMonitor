import * as THREE from 'three'

// Procedural materials keep the interactive model independent of remote assets.
export function surfaceTexture(kind) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')
  let seed = 7321
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const base = { plaster: '#e5dcc8', paving: '#c2b8a4', roof: '#ae6543', grass: '#63784e', asphalt: '#58606a', wood: '#80614a', stone: '#c3ae88' }[kind]
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 18000; i++) {
    ctx.fillStyle = `rgba(${random() > .5 ? '255,255,235' : '20,18,13'},${random() * .1})`
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 3)
  }
  if (kind === 'roof') {
    for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 32) {
      const grad = ctx.createLinearGradient(x, 0, x + 32, 0)
      grad.addColorStop(0, '#75402d'); grad.addColorStop(.25, '#b26f4c'); grad.addColorStop(.6, '#d49a6a'); grad.addColorStop(1, '#995235')
      ctx.fillStyle = grad; ctx.fillRect(x + 1, y + 1, 30, 61)
      ctx.strokeStyle = '#e0ac7c'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, 30, 61)
      ctx.fillStyle = '#633b2b'; ctx.fillRect(x, y + 60, 32, 4)
    }
  }
  if (kind === 'paving') {
    for (let row = 0; row < 8; row++) for (let col = -1; col < 9; col++) {
      const x = col * 64 + (row % 2) * 32; const y = row * 64
      ctx.strokeStyle = '#918a7e'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, 62, 62)
      ctx.fillStyle = `rgba(255,246,227,${random() * .16})`; ctx.fillRect(x + 3, y + 3, 59, 59)
    }
  }
  if (kind === 'wood') {
    for (let i = 0; i < 80; i++) { ctx.strokeStyle = `rgba(37,23,17,${random() * .3})`; ctx.beginPath(); ctx.moveTo(i * 7, 0); ctx.bezierCurveTo(i * 7 + random() * 10, 170, i * 7 - 4, 360, i * 7, 512); ctx.stroke() }
  }
  if (kind === 'stone') {
    for (let row = 0; row < 22; row++) {
      const height = 512 / 22
      let x = row % 2 ? -35 : 0
      while (x < 512) {
        const width = 35 + random() * 100
        const light = Math.floor(155 + random() * 70)
        ctx.fillStyle = `rgb(${light + 10},${light},${light - 27})`
        ctx.fillRect(x + 1, row * height + 1, width - 2, height - 2)
        ctx.fillStyle = '#e5d4b3'; ctx.fillRect(x + 2, row * height + 2, width - 4, 1)
        x += width
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(kind === 'grass' ? 12 : kind === 'plaster' ? 2 : 1, kind === 'grass' ? 12 : kind === 'roof' ? 2 : 1)
  texture.anisotropy = 8
  return texture
}
