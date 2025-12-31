import React, { useMemo, useRef } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// NOTE: Use the correct file name for your GLB
import modelUrl from './assets/Excavator_3D_Model.glb?url';
import useWebSocket from './useWebSocket';
import FitCamera from './FitCamera';

// --- Constants ---
const DEG_TO_RAD = Math.PI / 180;
const SCALE_FACTOR = 0.9;

function JcbArmModel({ controls, nodes, scene }) {

    // --- 1. Get Movable Nodes by Name ---
    const swingBaseNode = useMemo(() => nodes['Base_Swing-1'] || nodes['Turret'], [nodes]);
    const boomNode = useMemo(() => nodes['Boom1_Main-1'] || nodes['Boom'], [nodes]);
    const dipperNode = useMemo(() => nodes['Boom2_Dipper-1'] || nodes['Dipper'], [nodes]);
    const bucketNode = useMemo(() => nodes['Bucket-1'] || nodes['Bucket'], [nodes]);
const frozen = useRef(null);
    // --- 2. HIERARCHY RECONSTRUCTION ---
    useMemo(() => {
        if (!controls || !swingBaseNode || !boomNode || !dipperNode || !bucketNode) return;
        
        swingBaseNode.add(boomNode);
        boomNode.add(dipperNode);
        dipperNode.add(bucketNode);

    }, [nodes, swingBaseNode, boomNode, dipperNode, bucketNode]);

    // --- 3. Animation Loop ---
    useFrame(() => {
        if (!controls || !swingBaseNode || !boomNode || !dipperNode || !bucketNode) return;

        
        const switch1 = Number(controls.switch1) > 0;
    const switch2 = Number(controls.switch2) > 0;

    const isIdle = switch1 && !switch2;
    console.log("Is Idle:", isIdle);
    
    const engoff = switch1 && switch1;

if (isIdle || !engoff) {
    if (!frozen.current) {
        frozen.current = {
            swing: swingBaseNode.rotation.y,
            boom: boomNode.rotation.z,
            arm: dipperNode.rotation.z,
            bucket: bucketNode.rotation.z
        };
    }

    swingBaseNode.rotation.y = frozen.current.swing;
    boomNode.rotation.z = frozen.current.boom;
    dipperNode.rotation.z = frozen.current.arm;
    bucketNode.rotation.z = frozen.current.bucket;
    return;
} else {
    frozen.current = null;
}
        // 1. SWING
        const swingControl = (controls.swing + 100) / 200;
        swingBaseNode.rotation.y = swingControl * (Math.PI * 2);

        // 2. BOOM 1
        const boomRange = 105;
        const boomAngle = ((controls.boom + 100) / 200) * boomRange - 5;
        boomNode.rotation.z = boomAngle * DEG_TO_RAD;

        // 3. DIPPER / ARM
        const dipperRange = 160;
        const dipperAngle = ((controls.arm + 100) / -200) * dipperRange;
        dipperNode.rotation.z = dipperAngle * DEG_TO_RAD;

        // 4. BUCKET
        const bucketControl = controls.bucket / 100;
        const bucketAngle = bucketControl * 75;
        bucketNode.rotation.z = bucketAngle * DEG_TO_RAD;
    });

    return <primitive object={scene} />;
}

// Dashboard-style Sidebar Item
const SidebarItem = ({ icon, label, targetView, isActive = false, onNavigate }) => (
    <div
        onClick={() => onNavigate(targetView)}
        style={{
            textDecoration: 'none',
            cursor: 'pointer',
            color: isActive ? '#20c997' : '#fff',
            marginBottom: '30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: '1.1rem',
            fontWeight: '600',
            transition: 'color 0.2s, transform 0.2s, background-color 0.2s',
            padding: '5px',
            borderRadius: '8px',
            backgroundColor: isActive ? 'rgba(32, 201, 151, 0.1)' : 'transparent',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.color = '#20c997';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = isActive ? '#20c997' : '#fff';
        }}
        title={label}
    >
        <span style={{ fontSize: '1.7rem' }}>{icon}</span>
        <span style={{ fontSize: '0.75rem', marginTop: '3px', fontWeight: '500' }}>{label}</span>
    </div>
);

export function JcbArmSimulator({ onNavigate }) {
    const controls = useWebSocket('ws://10.161.10.201:8080');
    const groupRef = useRef();

    const { scene, nodes } = useGLTF(modelUrl);

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            backgroundColor: '#0A0A0A',
            color: '#ffffff',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            padding: '0',
            margin: '0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            position: 'relative',
        }}>

            {/* Background Pattern - Fixed positioning */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%)',
                zIndex: 0,
                pointerEvents: 'none'
            }}></div>

            {/* Sidebar Navigation - Same as Dashboard */}
            <nav style={{
                width: '80px',
                background: 'rgba(26, 26, 26, 0.95)',
                borderRight: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '30px',
                zIndex: 20,
                boxShadow: '2px 0 10px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(5px)',
                position: 'relative',
                flexShrink: 0
            }}>



                {/* Navigation Items */}
                <SidebarItem icon="📊" label="Dashboard" targetView="dashboard" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🧭" label="Sensors" targetView="sensors" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🕹️" label="Simulation" targetView="simulation" isActive={true} onNavigate={onNavigate} />
                <SidebarItem icon="🔧" label="Maintenance" targetView="maintenance" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🔬" label="Analyze" targetView="analyze" isActive={false} onNavigate={onNavigate} />
        <div style={{ marginTop: 'auto', marginBottom: '20px' }}>
          <SidebarItem icon="📊" label="Report" targetView="report" isActive={false} />
        </div>
            </nav>

            {/* Main Content Area - Full screen 3D Canvas */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                zIndex: 1,
                minWidth: 0
            }}>

                {/* Header Section - Same as Dashboard */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px 25px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(26, 26, 26, 0.85)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 10,
                    position: 'relative',
                    flexShrink: 0
                }}>
                    <h1 style={{
                        fontSize: '1.8rem',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        margin: 0
                    }}>
                        3D Simulation View 🚜
                    </h1>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <button style={{
                            backgroundColor: 'rgba(26, 26, 26, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            color: '#fff',
                            padding: '8px 15px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
                            backdropFilter: 'blur(10px)',
                            whiteSpace: 'nowrap'
                        }}
                            onMouseEnter={(e) => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.6)'; }}
                            onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)'; }}>
                            Select Vehicle
                        </button>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                            {[
                                { icon: '🔍', tooltip: 'Search' },
                                { icon: '🔔', tooltip: 'Notifications' },
                                { icon: '👤', tooltip: 'Profile' }
                            ].map((item, index) => (
                                <div key={index}
                                    style={{
                                        width: '35px',
                                        height: '35px',
                                        backgroundColor: 'rgba(26, 26, 26, 0.9)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                                        backdropFilter: 'blur(10px)',
                                        fontSize: '14px',
                                        flexShrink: 0
                                    }}
                                    onMouseEnter={(e) => { e.target.style.transform = 'scale(1.15)'; e.target.style.boxShadow = '0 6px 15px rgba(0, 0, 0, 0.5)'; e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
                                    onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)'; e.target.style.backgroundColor = 'rgba(26, 26, 26, 0.9)'; }}
                                    title={item.tooltip}
                                >
                                    {item.icon}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Full Screen 3D Canvas Area */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 0
                }}>
                    <Canvas
                        style={{ width: '100%', height: '100%', display: 'block' }}
                        camera={{ position: [0, 0, 0], fov: 50 }}
                    >
                        <ambientLight intensity={1} />
                        <directionalLight position={[100, 100, 100]} intensity={2} />
                        <OrbitControls enableDamping dampingFactor={0.05} />

                        <group ref={groupRef} scale={SCALE_FACTOR} position={[0, 0, 0]}>
                            <JcbArmModel controls={controls} nodes={nodes} scene={scene} />
                        </group>

                        <FitCamera targetRef={groupRef} padding={1.5} />
                    </Canvas>

                    {/* Real-time Controls Overlay */}
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '20px',
                        background: 'rgba(26, 26, 26, 0.9)',
                        backdropFilter: 'blur(15px)',
                        borderRadius: '15px',
                        padding: '15px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '12px',
                        minWidth: '200px'
                    }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#20c997' }}>Live Controls</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>Swing: <strong>{controls?.swing || 0}</strong></div>
                            <div>Boom: <strong>{controls?.boom || 0}</strong></div>
                            <div>Arm: <strong>{controls?.arm || 0}</strong></div>
                            <div>Bucket: <strong>{controls?.bucket || 0}</strong></div>
                        </div>
                    </div>
                    <div style={{ marginTop: '10px', fontWeight: '600', color: controls?.switch1 === 1 && controls?.switch2 !== 1 ? '#ff4d4f' : '#20c997' }}>
                        Status: {controls?.switch1 === 1 && controls?.switch2 !== 1 ? 'Idle 🚫' : 'Active ✅'}
                    </div>

                </div>
            </div>
        </div>
    );
}

export default JcbArmSimulator;