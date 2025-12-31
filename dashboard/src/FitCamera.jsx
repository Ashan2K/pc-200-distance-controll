// FitCamera.jsx
import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber'; // <-- MUST BE PRESENT
import * as THREE from 'three';

const FitCamera = ({ targetRef, padding = 1.2 }) => {
    const { camera, size, controls } = useThree(); 

    useEffect(() => {
        if (!targetRef.current) return;
        
        // 1. Calculate Bounding Box of the Model Group
        const box = new THREE.Box3().setFromObject(targetRef.current);
        const center = box.getCenter(new THREE.Vector3());
        const modelSize = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
        
        // 2. Calculate ideal distance based on model size and FOV
        const fov = camera.fov * (Math.PI / 180);
        let distance = maxDim / 2 / Math.tan(fov / 2);
        distance *= padding; 

        // 3. Set camera position and target
        const offset = new THREE.Vector3(distance, distance, distance);

        camera.position.copy(center).add(offset);
        
        if (controls) {
            controls.target.copy(center);
            controls.update();
        } else {
            camera.lookAt(center);
            camera.updateProjectionMatrix();
        }
    }, [targetRef, camera, size, padding, controls]);

    return null;
};
export default FitCamera;