import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Cylinder, Grid, useGLTF } from '@react-three/drei';

function CustomToolHead({ activeTool }) {
  // Load models (Drei caches them instantly behind the scenes)
  const boltHand = useGLTF('/Bolt Hand.glb');
  const claw = useGLTF('/Grabber hand.glb');
  const drill = useGLTF('/Drill Hand.glb');

  let model = null;
  if (activeTool === 1) model = boltHand.scene;
  if (activeTool === 2) model = claw.scene;
  if (activeTool === 3) model = drill.scene;

  if (!model) return null;

  // Scaling down to 0.025 for better proportion
  // Rotated 90 degrees (Math.PI / 2) on the X-axis to align parallel with the final bone
  return (
    <primitive 
      object={model} 
      scale={[0.025, 0.025, 0.025]} 
      position={[0, 0, 0]} 
      rotation={[Math.PI / 2, 0, 0]} 
    />
  );
}

// Preload globally so switching is instant
useGLTF.preload('/Bolt Hand.glb');
useGLTF.preload('/Grabber hand.glb');
useGLTF.preload('/Drill Hand.glb');

export default function ArmSimulation({ 
  az = 0, 
  th2 = -45, 
  th3 = 60, 
  d1 = 10, 
  a1 = 5, 
  a2 = 4, 
  a3 = 2,
  activeTool = 1
}) {
  const azRad = az * Math.PI / 180;
  const th2Rad = th2 * Math.PI / 180;
  const th3Rad = th3 * Math.PI / 180;

  // Reach and radius calculations using MATLAB equivalent logic
  const reach = a1 + a2 + a3;
  const base_r = 0.038 * reach;
  
  const tube1_r = base_r * 0.82;
  const tube2_r = base_r * 0.62;
  const tube3_r = tube2_r * 0.8; 

  const colors = {
    base: '#737380',
    link1: '#4c99f2',  // equivalent to [0.30 0.60 0.95]
    link2: '#40cc8c',  // equivalent to [0.25 0.80 0.55]
    link3: '#f2a640',  // equivalent to [0.95 0.65 0.25]
    joint: '#8c8c8c'
  };

  return (
    <Canvas camera={{ position: [reach * 1.5, d1 / 2, reach * 1.5], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} />
      <directionalLight position={[-10, 20, -10]} intensity={0.5} />
      
      {/* Floor Grid for reference */}
      <Grid infiniteGrid fadeDistance={reach * 3} position={[0, 0, 0]} sectionColor="#444" cellColor="#222" />
      
      {/* Ceiling Plane */}
      <mesh position={[0, d1, 0]} rotation={[Math.PI/2, 0, 0]}>
         <planeGeometry args={[reach * 2, reach * 2]} />
         <meshStandardMaterial color="#383842" side={2} transparent opacity={0.6} />
      </mesh>
      
      <OrbitControls makeDefault />

      {/* Mount Point (Ceiling) */}
      <group position={[0, d1, 0]}>
        {/* Base bracket/mount */}
        <Cylinder args={[base_r * 1.5, base_r * 1.5, base_r, 32]} position={[0, base_r/2, 0]}>
           <meshStandardMaterial color={colors.base} />
        </Cylinder>
        
        {/* Joint 1 (Azimuth) */}
        <group rotation={[0, azRad, 0]}>
          {/* Base sphere */}
          <Sphere args={[base_r * 1.8, 32, 32]} position={[0, 0, 0]}>
            <meshStandardMaterial color={colors.joint} />
          </Sphere>
          
          {/* Joint 2 (Shoulder Pitch) */}
          <group rotation={[th2Rad, 0, 0]}>
            {/* Link 1 extends down */}
            <Cylinder args={[tube1_r, tube1_r, a1, 32]} position={[0, -a1/2, 0]}>
              <meshStandardMaterial color={colors.link1} />
            </Cylinder>
            
            {/* End of Link 1 - Joint 3 (Elbow) */}
            <group position={[0, -a1, 0]}>
              <Sphere args={[tube1_r * 1.4, 32, 32]}>
                <meshStandardMaterial color={colors.link1} />
              </Sphere>
              
              {/* Elbow Pitch */}
              <group rotation={[th3Rad, 0, 0]}>
                {/* Link 2 */}
                <Cylinder args={[tube2_r, tube2_r, a2, 32]} position={[0, -a2/2, 0]}>
                  <meshStandardMaterial color={colors.link2} />
                </Cylinder>
                
                {/* End of Link 2 - Tool Mount */}
                <group position={[0, -a2, 0]}>
                  <Sphere args={[tube2_r * 1.4, 32, 32]}>
                     <meshStandardMaterial color={colors.link2} />
                  </Sphere>
                  
                  {/* Link 3 (Tool) */}
                  <Cylinder args={[tube3_r, tube3_r, a3, 32]} position={[0, -a3/2, 0]}>
                    <meshStandardMaterial color={colors.link3} />
                  </Cylinder>
                  
                  {/* End Effector Custom Tool Head */}
                  <group position={[0, -a3, 0]}>
                    <Suspense fallback={
                      <Sphere args={[tube3_r * 1.6, 32, 32]}>
                        <meshStandardMaterial color="#ffea33" />
                      </Sphere>
                    }>
                      <CustomToolHead activeTool={activeTool} />
                    </Suspense>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </Canvas>
  );
}
