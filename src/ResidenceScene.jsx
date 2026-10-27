import React, { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Sky, Html } from '@react-three/drei'
import * as THREE from 'three'
import { surfaceTexture } from './sceneMaterials.js'
import { RESIDENCE_ROOMS } from './residenceLayout.js'

const PANELS = Array.from({ length: 12 }, (_, i) => ({ index: i, side: i < 6 ? 'front' : 'rear', x: (i % 3 - 1) * 1.28, z: (Math.floor((i % 6) / 3) - .5) * 1.88 }))
function Block({ at, size, color = '#eee4cc', map, material = {}, rotation }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} map={map} roughness={.83} {...material} /></mesh>
}
function SoftBlock({ at, size, color, radius = .08, material = {} }) {
  return <RoundedBox position={at} args={size} radius={radius} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.6} {...material} /></RoundedBox>
}

function Tree({ at, scale = 1, cypress = false }) {
  const leaves = useRef()
  const foliage = useMemo(() => Array.from({ length: cypress ? 9 : 14 }, (_, i) => ({
    x: cypress ? Math.sin(i * 4) * .025 : Math.sin(i * 2.4) * (.35 + i % 3 * .18),
    y: cypress ? .8 + i * .32 : 2 + Math.sin(i * 1.8) * .5,
    z: cypress ? Math.cos(i * 4) * .025 : Math.cos(i * 2.4) * (.35 + i % 3 * .18),
    radius: cypress ? .26 - i * .018 : .5 + i % 3 * .07,
  })), [cypress])
  useEffect(() => {
    const transform = new THREE.Object3D()
    foliage.forEach((f, i) => {
      transform.position.set(f.x, f.y, f.z)
      transform.scale.set(f.radius, f.radius * (cypress ? 1.9 : .85), f.radius)
      transform.updateMatrix()
      leaves.current.setMatrixAt(i, transform.matrix)
      leaves.current.setColorAt(i, new THREE.Color(cypress ? ['#34472c', '#3c5030', '#405836'][i % 3] : ['#42583a', '#536b43', '#657c47', '#384e35'][i % 4]))
    })
    leaves.current.instanceMatrix.needsUpdate = true
    leaves.current.instanceColor.needsUpdate = true
  }, [foliage, cypress])
  return <group position={at} scale={scale}><mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[cypress ? .035 : .075, cypress ? .065 : .12, 2, 9]} /><meshStandardMaterial color="#66503b" /></mesh><instancedMesh ref={leaves} args={[null, null, foliage.length]} castShadow><sphereGeometry args={[1, 12, 9]} /><meshStandardMaterial roughness={1} /></instancedMesh></group>
}

function PanelCells() {
  const cells = useRef()
  useEffect(() => {
    const transform = new THREE.Object3D()
    for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
      transform.position.set((col - 1.5) * .255, .087, (row - 2.5) * .23)
      transform.updateMatrix()
      cells.current.setMatrixAt(row * 4 + col, transform.matrix)
    }
    cells.current.instanceMatrix.needsUpdate = true
  }, [])
  return <instancedMesh ref={cells} args={[null, null, 24]}><boxGeometry args={[.243, .004, .219]} /><meshStandardMaterial color="#173952" roughness={.25} metalness={.4} /></instancedMesh>
}

function Window({ at, width = 1.3, height = 1.1, night, rotation = 0 }) {
  return <group position={at} rotation={[0, rotation, 0]}>
    <Block at={[0, 0, 0]} size={[width + .16, height + .17, .1]} color="#f5ede1" />
    <Block at={[0, 0, .058]} size={[width, height, .04]} color={night ? '#e6b16b' : '#3f6572'} material={{ metalness: .35, roughness: .15, emissive: night ? '#e7a94e' : '#152b31', emissiveIntensity: night ? 1 : .1 }} />
    <Block at={[-width * .23, 0, .084]} size={[width * .4, height * .96, .01]} color={night ? '#f9dca7' : '#94a5a4'} material={{ transparent: true, opacity: .6, roughness: .8 }} />
    <Block at={[0, 0, .1]} size={[.04, height, .03]} color="#eeede5" />
    <Block at={[0, -height / 2 - .09, .08]} size={[width + .23, .08, .24]} color="#ede6d8" />
  </group>
}

function Module({ at, index, active, simulation, onToggle }) {
  return <group position={at} onClick={simulation ? (e) => { e.stopPropagation(); onToggle(index) } : undefined}>
    <Block at={[0, .035, 0]} size={[1.09, .065, 1.46]} color={active ? '#9daeb3' : '#dac193'} material={{ transparent: !active, opacity: active ? 1 : .25 }} />
    <Block at={[0, .075, 0]} size={[1.035, .016, 1.405]} color={active ? '#102e47' : '#b9a277'} material={{ metalness: .48, roughness: .22, transparent: !active, opacity: active ? 1 : .2 }} />
    {active && <PanelCells />}
    {!active && simulation && <Html center position={[0, .1, 0]} transform rotation={[-Math.PI / 2, 0, 0]} distanceFactor={3}><span className="roof-plus">+</span></Html>}
  </group>
}

function Car({ at, rotation = 0 }) {
  return <group position={at} rotation={[0, rotation, 0]}>
    {/* Compact black electric hatchback, modeled after the supplied BYD Mini photo. */}
    <SoftBlock at={[0, .52, 0]} size={[1.67, .56, 3.12]} color="#111416" radius={.22} material={{ metalness: .48, roughness: .23 }} />
    <SoftBlock at={[0, .94, -.12]} size={[1.38, .66, 1.76]} color="#101416" radius={.2} material={{ metalness: .44, roughness: .2 }} />
    <Block at={[0, 1.22, .61]} size={[1.13, .035, .72]} color="#233139" material={{ metalness: .35, roughness: .18 }} />
    <Block at={[0, 1.21, -.77]} size={[1.13, .035, .52]} color="#202a2e" material={{ metalness: .35, roughness: .18 }} />
    {[-1, 1].map((side) => <React.Fragment key={side}>
      <Block at={[side * .701, 1, -.1]} size={[.025, .48, .72]} color="#253239" material={{ metalness: .42, roughness: .18 }} />
      <Block at={[side * .845, .72, -.06]} size={[.035, .065, .16]} color="#191d1e" />
      <Block at={[side * .85, .72, .38]} size={[.035, .07, .18]} color="#191d1e" />
      <Block at={[side * .49, 1.03, .03]} size={[.035, .06, .13]} color="#c8d0cd" material={{ metalness: .7, roughness: .2 }} />
    </React.Fragment>)}
    {[-.76, .76].map((x) => [-.99, .99].map((z) => <group key={`${x}-${z}`} position={[x, .32, z]} rotation={[0, 0, Math.PI / 2]}><mesh castShadow><cylinderGeometry args={[.32, .32, .17, 24]} /><meshStandardMaterial color="#171a1c" roughness={.98} /></mesh><mesh position={[0, x > 0 ? -.095 : .095, 0]}><cylinderGeometry args={[.19, .19, .018, 12]} /><meshStandardMaterial color="#777f81" metalness={.82} roughness={.3} /></mesh></group>))}
    {[-.55, .55].map((x) => <Block key={x} at={[x, .57, 1.57]} size={[.36, .14, .045]} color="#dce4e1" material={{ emissive: '#dce4e1', emissiveIntensity: .28 }} />)}
    <Block at={[0, .42, 1.58]} size={[.68, .17, .025]} color="#1d2224" />
    {[-.59, .59].map((x) => <Block key={x} at={[x, .58, -1.57]} size={[.22, .25, .04]} color="#b53235" />)}
    <Block at={[0, .48, -1.59]} size={[.78, .12, .025]} color="#252a2c" />
  </group>
}

function TiledRoof({ at, width, depth, slope = 0, eave = 1, maps, children }) {
  const tiles = useRef()
  const count = Math.ceil(width / .23)
  useEffect(() => {
    const transform = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      transform.position.set((i - (count - 1) / 2) * width / count, .015, eave * (depth / 2 - .08))
      transform.rotation.set(Math.PI / 2, 0, 0)
      transform.updateMatrix()
      tiles.current.setMatrixAt(i, transform.matrix)
    }
    tiles.current.instanceMatrix.needsUpdate = true
  }, [count, width, depth, eave])
  return <group position={at} rotation={[slope, 0, 0]}>
    <Block at={[0, -.04, 0]} size={[width, .14, depth]} color="#fff2dc" map={maps.roof} />
    <Block at={[0, -.14, eave * (depth / 2 - .1)]} size={[width, .13, .12]} color="#634c37" />
    <instancedMesh ref={tiles} args={[null, null, count]} castShadow><cylinderGeometry args={[.085, .105, .31, 8]} /><meshStandardMaterial color="#ac7951" roughness={.95} /></instancedMesh>
    {children}
  </group>
}

function GardenHose() {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(-.3, .13, -11.2), new THREE.Vector3(-.8, .12, -10.3), new THREE.Vector3(-1.7, .12, -9.7), new THREE.Vector3(-2.3, .3, -8.9)]), [])
  return <group>{[.62, .51].map((radius) => <mesh key={radius} position={[-.2, .12, -11.8]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[radius, .025, 6, 40]} /><meshStandardMaterial color="#548778" /></mesh>)}<mesh><tubeGeometry args={[curve, 24, .025, 6, false]} /><meshStandardMaterial color="#548778" /></mesh></group>
}

function RoofGables({ maps, color }) {
  const shape = useMemo(() => new THREE.Shape().moveTo(-5.12, 0).lineTo(0, .78).lineTo(5.12, 0).closePath(), [])
  return [-2.58, 2.58].map((x) => <mesh key={x} position={[x, 5.76, -1]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color={color} map={maps.plaster} roughness={.9} side={THREE.DoubleSide} /></mesh>)
}

function Residence({ night, maps, panelCount = 12, simulation, onPanelToggle, neighboring = false }) {
  return <group>
    {/* Narrow duplex plot: driveway, two-storey block, rear veranda and lawn. */}
    <Block at={[0, .05, -2.6]} size={[5.58, .15, 25.6]} color="#dcd5bf" />
    <Block at={[0, .14, 7.05]} size={[5.4, .12, 6.3]} color="#f1e5cb" map={maps.paving} />
    {!neighboring && <Car at={[-.95, .22, 7.45]} rotation={-.06} />}
    <Block at={[0, 2.95, -1]} size={[5.16, 5.7, 10]} color={neighboring ? '#e7dac2' : '#fff0d3'} map={maps.plaster} />
    <RoofGables maps={maps} color={neighboring ? '#e7dac2' : '#fff0d3'} />
    {/* Front elevation from the photograph. */}
    <Block at={[1.62, 2.96, 4.07]} size={[.93, 5.69, .12]} color="#fff4d9" map={maps.stone} />
    <Window at={[-1.02, 4.47, 4.06]} width={1.62} height={1.13} night={night} />
    <Window at={[-1.04, 1.68, 4.06]} width={1.62} height={1.15} night={night} />
    <TiledRoof at={[-.7, 2.85, 4.56]} width={3.96} depth={1.22} slope={.13} maps={maps} />
    <Block at={[.53, 1.32, 4.1]} size={[.91, 2.28, .13]} color="#f2eee3" />
    <Block at={[.53, 1.32, 4.18]} size={[.72, 2.08, .04]} color="#e6e0d3" />
    {[.82, 1.82].map((y) => <Block key={y} at={[.53, y, 4.21]} size={[.5, .77, .035]} color={night ? '#c89d65' : '#6c6358'} material={{ emissive: night ? '#cb9758' : '#000', emissiveIntensity: night ? .35 : 0 }} />)}
    <Block at={[.8, 1.38, 4.25]} size={[.025, .22, .04]} color="#bbbcb4" material={{ metalness: .75 }} />
    <Block at={[-.7, .21, 4.31]} size={[3.8, .14, .58]} color="#d5cab3" />
    <Block at={[-1.04, .94, 4.22]} size={[1.58, .2, .32]} color="#d7c7a7" />
    {[-1.55, -1.18, -.82, -.48].map((x) => <mesh key={x} position={[x, 1.08, 4.24]}><sphereGeometry args={[.18, 8, 6]} /><meshStandardMaterial color="#617c49" /></mesh>)}
    <Block at={[1.7, .2, 4.72]} size={[1.25, .22, 1.1]} color="#b7b49c" />
    {[1.36, 1.94].map((x, i) => <Tree key={x} at={[x, .29, 4.73 + i * .13]} scale={i ? 1.31 : 1.43} cypress />)}
    {[-2.73, 2.73].map((x) => <Block key={`front-wall-${x}`} at={[x, .76, 7.05]} size={[.13, 1.45, 6.3]} color="#dfd1b3" map={maps.plaster} />)}
    {/* The configured solar system remains 12 modules, split across the two roof slopes. */}
    {['front', 'rear'].map((side) => <TiledRoof key={side} at={[0, 6.13, side === 'front' ? 1.6 : -3.6]} width={5.66} depth={5.35} slope={side === 'front' ? .15 : -.15} eave={side === 'front' ? 1 : -1} maps={maps}>
      {!neighboring && PANELS.filter((panel) => panel.side === side).map(({ index, x, z }) => <Module key={index} at={[x, .13, z]} index={index} active={index < panelCount} simulation={simulation} onToggle={onPanelToggle} />)}
    </TiledRoof>)}
    <mesh position={[0, 6.54, -1]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.105, .105, 5.72, 10]} /><meshStandardMaterial color="#a97a54" /></mesh>
    {/* Three upper rear openings and the covered patio visible in the rear photo. */}
    {[-1.72, 0, 1.72].map((x) => <Window key={x} at={[x, 4.46, -6.06]} width={.86} height={1.0} rotation={Math.PI} night={night} />)}
    <Window at={[.6, 1.38, -6.06]} width={2.04} height={2.12} rotation={Math.PI} night={night} />
    <Block at={[-1.65, 1.29, -6.09]} size={[.84, 2.28, .1]} color="#72573f" map={maps.wood} />
    <Block at={[0, .14, -7.65]} size={[5.35, .12, 3.4]} color="#d5d4c0" />
    <TiledRoof at={[0, 2.98, -7.55]} width={5.68} depth={3.65} slope={-.085} eave={-1} maps={maps} />
    {[-2.31, 2.31].map((x) => <Block key={x} at={[x, 1.4, -8.97]} size={[.25, 2.65, .25]} color="#a47750" map={maps.wood} />)}
    <Block at={[0, 2.64, -8.97]} size={[4.92, .2, .22]} color="#765334" map={maps.wood} />
    <Block at={[2.67, 1.12, -7.89]} size={[.09, 1.95, 1.75]} color="#34734f" />
    <Block at={[0, .08, -12.2]} size={[5.25, .11, 6.4]} color="#e2d7a6" map={maps.grass} />
    {[-2.73, 2.73].map((x) => <Block key={`rear-wall-${x}`} at={[x, .88, -11.9]} size={[.13, 1.7, 7.35]} color="#d8c9ac" map={maps.plaster} />)}
    <Block at={[0, .88, -15.55]} size={[5.58, 1.7, .14]} color="#d8c9ac" map={maps.plaster} />
    {!neighboring && <><GardenHose /><mesh position={[1.42, .3, -12.35]} castShadow><cylinderGeometry args={[.39, .28, .44, 16]} /><meshStandardMaterial color="#484940" /></mesh><mesh position={[1.42, .52, -12.35]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.34, 16]} /><meshStandardMaterial color="#77634d" /></mesh></>}
    {night && !neighboring && <><pointLight position={[-.7, 2.65, 4.55]} color="#ffd4a1" intensity={17} distance={8} /><pointLight position={[0, 2.5, -7.6]} color="#ffd5a3" intensity={13} distance={7} /></>}
  </group>
}

function FlowLine({ points, color, active = true, reverse = false }) {
  const dots = useRef([])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), [points])
  useFrame(({ clock }) => {
    dots.current.forEach((dot, i) => { if (dot) { let t = (clock.elapsedTime * .14 + i / 5) % 1; if (reverse) t = 1 - t; dot.position.copy(curve.getPoint(t)) } })
  })
  if (!active) return null
  return <group><mesh><tubeGeometry args={[curve, 64, .03, 7, false]} /><meshBasicMaterial color={color} transparent opacity={.65} /></mesh><mesh><tubeGeometry args={[curve, 64, .09, 7, false]} /><meshBasicMaterial color={color} transparent opacity={.07} depthWrite={false} /></mesh>{Array.from({ length: 5 }, (_, i) => <mesh key={i} ref={(el) => { dots.current[i] = el }}><sphereGeometry args={[.07, 10, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>)}</group>
}
const SOLAR_ROUTE = [[0, 6.85, -.7], [2.95, 5.7, 1.4], [2.96, 3.6, 4.15], [.58, 1.7, 4.35]]
const GRID_ROUTE = [[.58, 1.7, 4.35], [3.1, 1.1, 6.1], [3.35, 1, 9.5], [4.1, 1.7, 11.2]]

function FloatingReading({ at, type, value, subtitle, portal }) {
  return <Html portal={portal} position={at} center zIndexRange={[12, 5]} distanceFactor={15}><div className={`world-label ${type}`}><span>{type === 'solar' ? '☀' : type === 'home' ? '⌂' : 'ϟ'}</span><div><small>{type === 'solar' ? 'Produção solar' : type === 'home' ? 'Consumo da casa' : 'Rede elétrica'}</small><strong>{value == null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<em> kW</em></strong>{subtitle && <b>{subtitle}</b>}</div></div></Html>
}

function Furniture({ room, maps, color }) {
  if (room === 'Sala') return <><SoftBlock at={[-1.65, .52, .1]} size={[.85, .7, 2.45]} color="#a9b4a0" /><SoftBlock at={[-1.97, .88, .1]} size={[.19, .55, 2.45]} color="#87967b" /><Block at={[-.25, .37, .15]} size={[.85, .36, 1.2]} color="#d1ba94" map={maps.wood} /><Block at={[.9, .92, .2]} size={[.08, .95, 1.55]} color="#1a303a" /><Block at={[.94, .35, .2]} size={[.38, .35, 1.8]} color="#ad997d" /></>
  if (room === 'Cozinha') return <><Block at={[-1.94, .61, -.12]} size={[.7, .98, 3.3]} color="#d7d8ca" /><Block at={[-1.94, 1.13, -.12]} size={[.75, .08, 3.4]} color="#586566" /><Block at={[-1.93, 1.18, -.65]} size={[.5, .03, .65]} color="#aab8ba" /><Block at={[.1, .61, -.3]} size={[1.05, .98, 1.7]} color="#cfb287" map={maps.wood} /><Block at={[.1, 1.13, -.3]} size={[1.14, .08, 1.82]} color="#ece7db" /><Block at={[1.78, 1.1, -1.65]} size={[.8, 1.95, .85]} color="#cbd2cc" /></>
  return <><SoftBlock at={[-.38, .44, .12]} size={[1.5, .48, 2.15]} color="#a18a70" /><SoftBlock at={[-.38, .75, .21]} size={[1.46, .17, 1.91]} color={color} /><SoftBlock at={[-.38, .87, -.52]} size={[1.23, .12, .43]} color="#f1e8d6" /><Block at={[-.38, .8, -1.02]} size={[1.66, 1.25, .1]} color="#ad8e69" map={maps.wood} /><Block at={[-1.42, .45, -.65]} size={[.42, .54, .5]} color="#b79a73" /><Block at={[1.37, 1, -.1]} size={[.62, 1.75, 2.16]} color="#d9cfba" /><Block at={[1.04, 1, -.1]} size={[.03, 1.68, .025]} color="#a09279" /></>
}

function Interior({ maps, floor, selectedRoom, onRoomSelect, labelPortal }) {
  const upper = floor === 'upper'
  const rooms = RESIDENCE_ROOMS[floor]
  const level = upper ? 3 : 0
  return <group>
    {upper && <><Block at={[0, .08, -1]} size={[5.42, .16, 10.4]} color="#c4baa7" />{[-2.5, 2.5].map((x) => [-5.9, 3.9].map((z) => <Block key={`${x}-${z}`} at={[x, 1.5, z]} size={[.17, 3, .17]} color="#bfb8a8" />))}</>}
    <group position={[0, level, 0]}>
      <Block at={[0, .1, -1]} size={[5.42, .2, 10.4]} color="#eee5d3" map={maps.paving} />
      {[-2.62, 2.62].map((x) => <Block key={x} at={[x, .72, -1]} size={[.14, 1.05, 10.4]} color="#e6d8be" />)}
      {[-6.13, 4.13].map((z) => <Block key={z} at={[0, .72, z]} size={[5.38, 1.05, .14]} color="#e6d8be" />)}
      {upper ? <><Block at={[1.92, .22, -1]} size={[1.2, .04, 10]} color="#d8d3c5" />{[.61, -2.6].map((z) => <Block key={z} at={[-.61, .7, z]} size={[3.88, 1, .12]} color="#e6d8be" />)}{rooms.map((room) => <group key={`door-${room.name}`}>{[-1, 1].map((sign) => <Block key={sign} at={[1.34, .7, room.z + sign * (.4 + (room.depth - .8) / 4)]} size={[.12, 1, (room.depth - .8) / 2]} color="#e6d8be" />)}<Block at={[1.07, .55, room.z + .28]} size={[.7, .7, .06]} rotation={[0, -.7, 0]} color="#bd9d70" /></group>)}</> : <Block at={[-.25, .7, -1.1]} size={[4.65, 1, .12]} color="#e6d8be" />}
      {rooms.map((room) => <group key={room.name}>
        <mesh position={[room.x, .215, room.z]} rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); onRoomSelect(room.name) }} receiveShadow><planeGeometry args={[room.width, room.depth]} /><meshStandardMaterial color={selectedRoom === room.name ? '#8dbba0' : room.color} /></mesh>
        <group position={[room.x, 0, room.z]}><Furniture room={room.name} maps={maps} color={room.color} /></group>
        <Html portal={labelPortal} zIndexRange={[12, 5]} position={[room.x + .3, .65, room.z + room.depth * .35]} center><button className={`room-marker ${selectedRoom === room.name ? 'active' : ''}`} onClick={() => onRoomSelect(room.name)}>{room.name}</button></Html>
      </group>)}
      {Array.from({ length: 10 }, (_, i) => <Block key={i} at={[1.96, upper ? .25 : .2 + .14 * (i + 1), 3.55 - i * .3]} size={[.98, upper ? .045 : .28 * (i + 1), .29]} color={i % 2 ? '#a89b84' : '#c6bca7'} />)}
    </group>
    <Block at={[0, .1, 7.1]} size={[5.45, .14, 5.8]} color="#e1d5bb" map={maps.paving} />
  </group>
}

const CAMERA = { aerial: [15, 19, 26], street: [4.2, 5.8, 17.5], rear: [7.5, 10, -25], top: [0, 33, -2.4], interior: [13, 17, 19], plan: [0, 27, -1] }
function CameraRig({ preset, floor, controlRef }) {
  const { camera, size } = useThree()
  useEffect(() => { const position = CAMERA[preset] || CAMERA.aerial; camera.position.set(...position); const portrait = size.width / size.height < .85; camera.position.multiplyScalar(portrait ? 1.22 : 1); const inside = preset === 'interior' || preset === 'plan'; controlRef.current?.target.set(0, inside ? floor === 'upper' ? 3 : 0 : 2, inside ? -1 : preset === 'rear' ? -6.5 : preset === 'street' ? 2 : -2.5); controlRef.current?.update() }, [preset, floor, camera, controlRef, size.width, size.height])
  return null
}

function World({ labelPortal, focused, night, sun, panelCount, simulation, onPanelToggle, showFlow, current, labels, mode, floor, selectedRoom, onRoomSelect }) {
  const maps = useMemo(() => Object.fromEntries(['plaster', 'paving', 'roof', 'grass', 'asphalt', 'wood', 'stone'].map((key) => [key, surfaceTexture(key)])), [])
  useEffect(() => () => Object.values(maps).forEach((map) => map.dispose()), [maps])
  const inside = mode === 'interior' || mode === 'plan'
  // Scene north is -Z and east is +X. GPS sets the astronomical direction;
  // the illustration itself has no measured compass alignment.
  const sunDirection = sun ? [sun.east * 60, sun.up * 60, -sun.north * 60] : [-15, 18, 10]
  const daylight = sun ? Math.min(1, Math.max(0, sun.elevation / 45)) : 1
  return <>
    <color attach="background" args={[night ? '#071424' : daylight < .25 ? '#d1aa91' : '#a9c9da']} /><fog attach="fog" args={[night ? '#071424' : daylight < .25 ? '#d0b5a1' : '#b0cbd7', 32, 80]} />
    {!night && <Sky distance={10000} sunPosition={sunDirection} turbidity={3} rayleigh={.7} />}
    <hemisphereLight args={[night ? '#7090c9' : '#d5e8f1', night ? '#19231d' : '#b5a88b', night ? .7 : .65 + daylight * .8]} />
    <directionalLight position={night ? [-11, 19, 12] : sunDirection} intensity={night ? .8 : .65 + daylight * 2.45} color={night ? '#9cbaef' : daylight < .3 ? '#ffd3a0' : '#fff1d4'} castShadow shadow-mapSize={[2048, 2048]} shadow-normalBias={.025} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <Block at={[0, -.28, 0]} size={[150, .3, 150]} color="#fff" map={maps.grass} />
    <Block at={[0, -.08, 13]} size={[110, .08, 5]} color="#fff" map={maps.asphalt} />
    <Block at={[0, -.01, 10.35]} size={[80, .15, .45]} color="#b7b7a7" />
    <Block at={[0, -.02, 15.65]} size={[80, .14, .45]} color="#b7b7a7" />
    <Block at={[0, -.08, -18.7]} size={[110, .08, 5.3]} color="#fff" map={maps.asphalt} />
    {Array.from({ length: 16 }, (_, i) => <Block key={i} at={[(i - 8) * 5, -.027, 13]} size={[2.2, .014, .075]} color="#c8c8ab" />)}
    {inside ? <Interior labelPortal={labelPortal} maps={maps} floor={floor} selectedRoom={selectedRoom} onRoomSelect={onRoomSelect} /> : <Residence maps={maps} night={night} panelCount={panelCount} simulation={simulation} onPanelToggle={onPanelToggle} />}
    {!inside && !focused && [-5.58, 5.58].map((x) => <group key={x} position={[x, 0, 0]}><Residence night={night} maps={maps} neighboring /></group>)}
    {Array.from({ length: 12 }, (_, i) => <Tree key={i} at={[(i - 6) * 3.3, 0, -24 - i % 3 * 2]} scale={1.1 + i % 4 * .15} />)}
    {[-13, -11, 12, 14].map((x, i) => <Tree key={x} at={[x, 0, 5 - i % 2 * 7]} scale={1.25} />)}
    {showFlow && !simulation && !inside && <><FlowLine points={SOLAR_ROUTE} color="#7bf6a1" active={current.solar_kw > 0} /><FlowLine points={GRID_ROUTE} color={current.import_kw > 0 ? '#ff9b63' : '#6bacff'} active={current.import_kw > 0 || current.export_kw > 0} reverse={current.import_kw > 0} /></>}
    {labels && !inside && <><FloatingReading portal={labelPortal} at={[-2, 7.05, -.3]} type="solar" value={current.solar_kw} /><FloatingReading portal={labelPortal} at={[-1.4, 2.4, 5.3]} type="home" value={current.consumption_kw} /><FloatingReading portal={labelPortal} at={[3.6, 2, 9.6]} type="grid" value={current.import_kw > 0 ? current.import_kw : current.export_kw ?? current.import_kw} subtitle={current.import_kw > 0 ? 'Importando' : current.export_kw > 0 ? 'Exportando' : null} /></>}
  </>
}

export default function ResidenceScene({ focused = false, night = false, sun = null, panelCount = 12, simulation = false, onPanelToggle = () => {}, showFlow = true, current = {}, labels = false, cameraPreset = 'aerial', mode = 'exterior', floor = 'ground', selectedRoom = 'Sala', onRoomSelect = () => {} }) {
  const controls = useRef()
  const labelPortal = useRef()
  const preset = mode === 'interior' || mode === 'plan' ? mode : cameraPreset
  return <div className="residence-scene"><Canvas shadows camera={{ position: CAMERA[preset], fov: 37 }} dpr={[1, 1.5]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
    <World labelPortal={labelPortal} focused={focused} night={night} sun={sun} panelCount={panelCount} simulation={simulation} onPanelToggle={onPanelToggle} showFlow={showFlow} current={current} labels={labels} mode={mode} floor={floor} selectedRoom={selectedRoom} onRoomSelect={onRoomSelect} />
    <OrbitControls ref={controls} makeDefault target={[0, 2, -2.5]} minDistance={10} maxDistance={60} minPolarAngle={.01} maxPolarAngle={1.43} enablePan={false} enableRotate={mode !== 'plan'} />
    <CameraRig preset={preset} floor={floor} controlRef={controls} />
  </Canvas><div className="scene-label-layer" ref={labelPortal} /></div>
}
