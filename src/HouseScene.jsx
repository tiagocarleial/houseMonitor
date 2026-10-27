import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Grid } from '@react-three/drei'
import * as THREE from 'three'

const MODULE_POSITIONS = Array.from({ length: 12 }, (_, i) => ({
  x: (i % 3 - 1) * 1.18,
  z: (Math.floor(i / 3) - 1.5) * 1.58,
}))

function Box({ position, scale, color, material = {} }) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={scale} />
    <meshStandardMaterial color={color} roughness={0.8} {...material} />
  </mesh>
}

function Tree({ x, z, size = 1, night }) {
  return <group position={[x, 0, z]}>
    <Box position={[0, 0.75 * size, 0]} scale={[0.16 * size, 1.5 * size, 0.16 * size]} color="#604733" />
    <mesh position={[0, 1.78 * size, 0]} castShadow>
      <icosahedronGeometry args={[0.74 * size, 1]} />
      <meshStandardMaterial color={night ? '#1f503c' : '#3e8054'} flatShading />
    </mesh>
    <mesh position={[0.3 * size, 2.15 * size, 0.1 * size]} castShadow>
      <icosahedronGeometry args={[0.47 * size, 1]} />
      <meshStandardMaterial color={night ? '#245841' : '#52966a'} flatShading />
    </mesh>
  </group>
}

function Neighbor({ x, roofColor, night }) {
  return <group position={[x, 0, -0.45]}>
    <Box position={[0, 1.95, 0]} scale={[4.7, 3.9, 8.6]} color={night ? '#59646a' : '#c8b5a0'} />
    <Box position={[0, 4.07, 0]} scale={[5.1, 0.36, 9]} color={roofColor} />
    {[-2.5, 2.5].map((z) => <Box key={z} position={[x < 0 ? 2.37 : -2.37, 2.4, z]} scale={[0.04, 1.2, 1.25]} color={night ? '#6e9caa' : '#527e8c'} material={{ metalness: 0.25, roughness: 0.24 }} />)}
  </group>
}

function SolarPanel({ x, z, index, active, simulation, onToggle }) {
  return <group position={[x, 0.16, z]} onClick={(event) => {
    if (!simulation) return
    event.stopPropagation()
    onToggle(index)
  }}>
    <mesh castShadow>
      <boxGeometry args={[1.08, 0.055, 1.46]} />
      <meshStandardMaterial color={active ? '#a9c9d8' : '#8b775c'} transparent opacity={active ? 1 : 0.45} />
    </mesh>
    <mesh position={[0, 0.032, 0]}>
      <boxGeometry args={[1.005, 0.017, 1.38]} />
      <meshStandardMaterial color={active ? '#102944' : '#856e4f'} transparent opacity={active ? 1 : 0.38} metalness={0.25} roughness={0.24} />
    </mesh>
    {active && [-0.25, 0, 0.25].map((line) => <Box key={line} position={[line, 0.045, 0]} scale={[0.008, 0.003, 1.34]} color="#5982aa" />)}
    {active && [-0.34, 0, 0.34].map((line) => <Box key={line} position={[0, 0.047, line]} scale={[0.97, 0.003, 0.008]} color="#5982aa" />)}
    {!active && simulation && <mesh position={[0, 0.06, 0]}>
      <boxGeometry args={[0.18, 0.02, 0.18]} />
      <meshBasicMaterial color="#f6cb76" />
    </mesh>}
  </group>
}

function Townhouse({ night, panelCount, simulation, onPanelToggle }) {
  const wall = night ? '#b3ada2' : '#eee0c6'
  const glass = night ? '#edb967' : '#6a94a4'
  return <group>
    <Box position={[0, 0.12, 1.3]} scale={[5, 0.23, 15]} color="#b2a995" />
    <Box position={[0, 2.55, -0.5]} scale={[4.35, 5.1, 8.15]} color={wall} />
    <Box position={[0, 5.14, -0.5]} scale={[4.55, 0.25, 8.5]} color="#a75e3d" />
    <group position={[0, 5.33, -0.5]} rotation={[-0.105, 0, 0]}>
      <Box position={[0, 0, 0]} scale={[4.55, 0.13, 8.05]} color="#bc6f45" />
      {Array.from({ length: 22 }, (_, i) => <Box key={`tile-${i}`} position={[-2.18 + i * 0.207, 0.075, 0]} scale={[0.014, 0.02, 7.98]} color="#db9060" />)}
      {Array.from({ length: 22 }, (_, i) => <Box key={`tile-row-${i}`} position={[0, 0.076, -3.93 + i * 0.37]} scale={[4.4, 0.018, 0.014]} color="#9f5739" />)}
      {MODULE_POSITIONS.map(({ x, z }, i) => <SolarPanel key={i} x={x} z={z} index={i} active={i < panelCount} simulation={simulation} onToggle={onPanelToggle} />)}
    </group>
    <Box position={[0, 4.18, 3.615]} scale={[1.62, 1.04, 0.08]} color="#fbfbf6" />
    <Box position={[0, 4.18, 3.665]} scale={[1.43, 0.84, 0.05]} color={glass} material={{ metalness: 0.25, roughness: 0.15, emissive: night ? '#b87830' : '#000000', emissiveIntensity: night ? 0.45 : 0 }} />
    <Box position={[0, 4.18, 3.705]} scale={[0.07, 0.84, 0.04]} color="#f1ede3" />
    <Box position={[-0.85, 2.43, 3.63]} scale={[1.72, 0.34, 1.03]} color="#a75e3d" />
    <Box position={[-0.85, 1.62, 3.66]} scale={[1.46, 1.23, 0.08]} color="#fff9ed" />
    <Box position={[-0.85, 1.62, 3.715]} scale={[1.29, 1.07, 0.045]} color={glass} material={{ emissive: night ? '#be884c' : '#000000', emissiveIntensity: night ? 0.35 : 0 }} />
    <Box position={[-0.85, 1.62, 3.75]} scale={[0.07, 1.07, 0.04]} color="#e9e5d9" />
    <Box position={[1.16, 1.23, 3.68]} scale={[0.94, 2.38, 0.09]} color="#f6f0e2" />
    <Box position={[1.16, 1.35, 3.75]} scale={[0.74, 1.98, 0.04]} color="#9e9689" />
    <Box position={[1.45, 1.32, 3.79]} scale={[0.06, 0.06, 0.03]} color="#d4bd81" />
    <Box position={[0, 0.21, 5.1]} scale={[4.35, 0.08, 2.25]} color="#d7c6a7" />
    <Box position={[-2.28, 0.63, 4.5]} scale={[0.1, 1.25, 8]} color="#e6d4b6" />
    <Box position={[2.28, 0.63, 4.5]} scale={[0.1, 1.25, 8]} color="#e6d4b6" />
    <Tree x={1.79} z={3.55} size={0.77} night={night} />
    <Tree x={1.77} z={5.25} size={0.64} night={night} />
    <Box position={[-1.1, 0.29, 6.6]} scale={[0.9, 0.3, 0.55]} color="#618050" />
    <Box position={[0.3, 0.29, 6.6]} scale={[0.8, 0.3, 0.55]} color="#688b54" />
  </group>
}

function EnergyPath({ night }) {
  const roofCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 5.65, -1), new THREE.Vector3(1.8, 5.85, 0.8),
    new THREE.Vector3(2.9, 3.7, 2.8), new THREE.Vector3(1.3, 1.6, 3.85),
  ]), [])
  const gridCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.3, 1.6, 3.85), new THREE.Vector3(3.3, 1.1, 4.6),
    new THREE.Vector3(4.6, 1.3, 6.7), new THREE.Vector3(5.1, 1.7, 8.7),
  ]), [])
  return <group>
    <mesh>
      <tubeGeometry args={[roofCurve, 40, 0.044, 8, false]} />
      <meshBasicMaterial color="#47e6a6" transparent opacity={night ? 0.98 : 0.82} />
    </mesh>
    <mesh>
      <tubeGeometry args={[gridCurve, 40, 0.035, 8, false]} />
      <meshBasicMaterial color="#5aa9ff" transparent opacity={night ? 0.95 : 0.72} />
    </mesh>
  </group>
}

function World({ night, panelCount, simulation, onPanelToggle, showFlow }) {
  return <>
    <color attach="background" args={[night ? '#081323' : '#bfd7e5']} />
    <ambientLight intensity={night ? 0.55 : 1.8} color={night ? '#9bb6ea' : '#fff7e6'} />
    <directionalLight position={[-8, 14, 7]} intensity={night ? 1.1 : 2.3} color={night ? '#7ea0d6' : '#fff0cd'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} />
    {night && <pointLight position={[0, 4, 8]} color="#ffbd70" intensity={25} distance={15} />}
    <Box position={[0, -0.18, 0]} scale={[40, 0.22, 40]} color={night ? '#263b41' : '#90ae8f'} />
    <Box position={[0, -0.035, 9.5]} scale={[40, 0.05, 4.1]} color={night ? '#303a49' : '#687780'} />
    <Box position={[0, 0.006, 7.4]} scale={[40, 0.025, 0.1]} color="#d7d7c9" />
    <Box position={[0, 0.006, 11.55]} scale={[40, 0.025, 0.1]} color="#d7d7c9" />
    <Neighbor x={-5.15} roofColor={night ? '#463e43' : '#a5745e'} night={night} />
    <Neighbor x={5.15} roofColor={night ? '#4c4749' : '#947f69'} night={night} />
    <Townhouse night={night} panelCount={panelCount} simulation={simulation} onPanelToggle={onPanelToggle} />
    {[-8, -6.5, 7.2, 9.2].map((x, i) => <Tree key={x} x={x} z={i % 2 ? -5.8 : 5.2} size={i % 2 ? 1.2 : 0.9} night={night} />)}
    {showFlow && !simulation && <EnergyPath night={night} />}
    <ContactShadows position={[0, 0, 0]} scale={25} opacity={night ? 0.2 : 0.38} blur={2.6} far={14} />
  </>
}

export default function HouseScene({ night = false, panelCount = 12, simulation = false, onPanelToggle = () => {}, showFlow = true }) {
  return <Canvas shadows camera={{ position: [10.7, 12.3, 15.5], fov: 35 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
    <World night={night} panelCount={panelCount} simulation={simulation} onPanelToggle={onPanelToggle} showFlow={showFlow} />
    <OrbitControls makeDefault target={[0, 2.1, 1]} minDistance={10} maxDistance={28} minPolarAngle={0.2} maxPolarAngle={1.46} enablePan={false} />
  </Canvas>
}
