import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

import modelPath from '/src/assets/Excavator_3D_Model.glb?url';

const Model = ({ position = [0, 0, 0] }) => {
  const { scene } = useGLTF(modelPath);
  return <primitive object={scene} scale={1} position={position} />;
};

const ExcavatorModel = () => {
  return (
    <Canvas camera={{ position: [5, 2, 5], fov: 80 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model position={[0, -4, 0]} />
      </Suspense>
      <OrbitControls />
    </Canvas>
  );
};

export default ExcavatorModel;