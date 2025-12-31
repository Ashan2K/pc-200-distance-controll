import React, { useEffect, useState } from 'react';
import { GaugeComponent } from 'react-gauge-component';
import useWebSocket from './useWebSocket';
import { analyzeMachineHealth } from './diagnosisEngine';

// --- CONFIGURATION ---
const SERVER_IP = '10.161.10.201';
const PORT_KOMATSU = 8081;
const KOMATSU_WS_URL = `ws://${SERVER_IP}:${PORT_KOMATSU}`;

const getPhysicalValue = (val, type, manualMax) => {
    if (val === undefined || val === null) return 0;

    let voltage;
    // Reverse the scaling based on your ESP32 multipliers
    if (type === 'temp') {
        // ESP32 used: (v - 0.5) * 37.5. (4.5-0.5)*37.5 = 150 (but your sample shows 105 max)
        voltage = (val / 26.25) + 0.5;
    } else {
        // ESP32 used: (v - 0.5) * 7.0 or 10.0. For your '28' values:
        voltage = (val / 7.0) + 0.5;
    }

    if (voltage < 0.55) return 0; // Signal Floor
    return (voltage - 0.5) * (manualMax / 4.0);
};

// Define sensor max values and units for the Gauges
const SENSOR_METADATA = {
    // Levels/Temps
    eng_wtr_temp: { name: "Engine Water Temp", unit: "°C", max: 120, color: "#DC3545" },
    hyd_oil_temp: { name: "Hydraulic Oil Temp", unit: "°C", max: 100, color: "#5BC0DE" },
    fuel_lvl: { name: "Fuel Level", unit: "%", max: 100, color: "#17A2B8" },
    eng_oil_lvl: { name: "Engine Oil Level", unit: "%", max: 100, color: "#FFC107" },
    ac_amb_temp: { name: "AC Ambient Temp", unit: "°C", max: 60, color: "#6C757D" },

    // Pressures (Max 40 MPa for hydraulics, 1 MPa for others)
    rail_prs: { name: "Common Rail Press", unit: "MPa", max: 40, color: "#007BFF" },
    rear_pump_prs: { name: "Rear Pump Press", unit: "MPa", max: 40, color: "#007BFF" },
    front_pump_prs: { name: "Front Pump Press", unit: "MPa", max: 40, color: "#007BFF" },
    arm_dig_prs: { name: "Arm Dig Press", unit: "MPa", max: 40, color: "#0056b3" },
    arm_dump_prs: { name: "Arm Dump Press", unit: "MPa", max: 40, color: "#0056b3" },
    bucket_dig_prs: { name: "Bucket Dig Press", unit: "MPa", max: 40, color: "#0056b3" },
    bucket_dump_prs: { name: "Bucket Dump Press", unit: "MPa", max: 40, color: "#0056b3" },
    boom_up_prs: { name: "Boom Up Press", unit: "MPa", max: 40, color: "#0056b3" },
    boom_down_prs: { name: "Boom Down Press", unit: "MPa", max: 40, color: "#0056b3" },
    swing_left_prs: { name: "Swing Left Press", unit: "MPa", max: 40, color: "#6C757D" },
    swing_right_prs: { name: "Swing Right Press", unit: "MPa", max: 40, color: "#6C757D" },
    travel_lf_prs: { name: "Travel LF Press", unit: "MPa", max: 40, color: "#F0AD4E" },
    travel_lr_prs: { name: "Travel LR Press", unit: "MPa", max: 40, color: "#F0AD4E" },
    travel_rf_prs: { name: "Travel RF Press", unit: "MPa", max: 40, color: "#F0AD4E" },
    travel_rr_prs: { name: "Travel RR Press", unit: "MPa", max: 40, color: "#F0AD4E" },
    boost_prs: { name: "Boost Pressure", unit: "MPa", max: 1, color: "#343A40" },
    amb_air_prs: { name: "Ambient Air Press", unit: "MPa", max: 0.15, color: "#343A40" },
    sunshine_sen: { name: "Sunshine Sensor", unit: "°C", max: 100, color: "#FFEB3B" },
};

// Initial state for Komatsu (must include all keys)
const INITIAL_KOMATSU_STATE = {
    ...Object.keys(SENSOR_METADATA).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
    rad_wtr_lvl: 0, crank_sen: 0, cam_sen: 0, air_cln_cld: 0, wtr_in_fuel: 0
};

// --- HELPER: NOTIFICATION BOX ---
const NotificationItem = ({ type, message, code }) => (
    <div style={{
        padding: '12px',
        marginBottom: '10px',
        borderRadius: '8px',
        backgroundColor: type === 'error' ? 'rgba(220, 53, 69, 0.2)' : 'rgba(255, 193, 7, 0.2)',
        borderLeft: `5px solid ${type === 'error' ? '#dc3545' : '#ffc107'}`,
        animation: 'slideIn 0.3s ease-out',
        color: '#fff'
    }}>
        <div style={{ fontWeight: 'bold', fontSize: '12px', color: type === 'error' ? '#ff6b6b' : '#ffd54f' }}>
            {type === 'error' ? `CRITICAL FAULT: ${code}` : 'PREDICTION'}
        </div>
        <div style={{ fontSize: '13px', marginTop: '4px' }}>{message}</div>
    </div>
);

// ----------------------------------------------------------------------
// --- Status Indicator Component ---
// ----------------------------------------------------------------------

const StatusIndicator = ({ label, value }) => {
    const isOn = value === 1 || value === true;
    const color = isOn ? '#28a745' : '#DC3545';
    const bgColor = isOn ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)';

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 10px',
            margin: '4px',
            borderRadius: '4px',
            backgroundColor: bgColor,
            border: `1px solid ${color}`,
            flexGrow: 1,
            color: '#F8F9FA',
            minWidth: '150px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    marginRight: '6px'
                }} />
                <span style={{ fontWeight: 'bold', fontSize: '0.85em' }}>{label}:</span>
            </div>
            <span style={{ color: color, fontWeight: 'bold', fontSize: '0.85em' }}>
                {isOn ? 'OK' : 'WARNING'}
            </span>
        </div>
    );
};

// ----------------------------------------------------------------------
// --- Sensor Gauge Component ---
// ----------------------------------------------------------------------

const SensorGauge = ({ value, name, unit, max, min = 0, color }) => {
    const safeValue = value ?? min;
    const clampedValue = Math.max(min, Math.min(max, safeValue));

    return (
        <div style={{
            margin: '15px',
            padding: '20px',
            borderRadius: '10px',
            width: '280px',
            height: '320px',
            textAlign: 'center',
            backgroundColor: '#1E1E1E',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
            color: '#E0E0E0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
        }}>
            <div>
                <h4 style={{ marginBottom: '5px', color: '#B0B0B0', fontSize: '14px' }}>{name}</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: color, margin: '10px 0' }}>
                    {safeValue.toFixed(1)} {unit}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <GaugeComponent
                    type="semicircle"
                    arc={{
                        width: 0.2,
                        padding: 0.005,
                        cornerRadius: 3,
                        subArcs: [
                            { limit: max * 0.2, color: '#28a745' },
                            { limit: max * 0.4, color: '#5cb85c' },
                            { limit: max * 0.6, color: '#ffc107' },
                            { limit: max * 0.8, color: '#fd7e14' },
                            { limit: max, color: '#dc3545' }
                        ]
                    }}
                    pointer={{
                        type: "needle",
                        color: "#ffffffff",
                        length: 0.70,
                        width: 5,
                        animate: true,
                        animationDuration: 3000
                    }}
                    labels={{
                        valueLabel: {
                            formatTextValue: (value) => `${value.toFixed(1)}${unit}`,
                            style: { fontSize: '20px', fill: '#E0E0E0' }
                        },
                        tickLabels: {
                            hideMinMax: true,
                            defaultTickValueConfig: {
                                style: { fontSize: '8px', fill: '#B0B0B0' }
                            }
                        }
                    }}
                    minValue={min}
                    maxValue={max}
                    value={clampedValue}
                    style={{ width: '100%', height: '180px' }}
                />
            </div>
        </div>
    );
};

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

// ----------------------------------------------------------------------
// --- MAIN METER BOARD ---
// ----------------------------------------------------------------------
const MeterBoard = ({ onNavigate }) => {
    const komatsuDataRaw = useWebSocket(KOMATSU_WS_URL);

    // Merge received data with initial state 
    const komatsuData = { ...INITIAL_KOMATSU_STATE, ...(komatsuDataRaw || {}) };
    const isConnected = komatsuDataRaw !== null;

    // Engine Running Logic
    const isEngineRunning = komatsuData.crank_sen === 1 || komatsuData.cam_sen === 1;
    // Replace the useMemo line with these:
    const [health, setHealth] = useState({ errors: [], predictions: [] });

    useEffect(() => {
        const runAnalysis = async () => {
            if (isConnected && isEngineRunning) {
                try {
                    const result = await analyzeMachineHealth(komatsuData);
                    // Ensure result is not null and has the expected arrays
                    if (result) {
                        setHealth({
                            errors: result.errors || [],
                            predictions: result.predictions || []
                        });
                    }
                } catch (err) {
                    console.error("Diagnostic engine error:", err);
                }
            } else {
                // Clear errors if engine is off or disconnected
                setHealth({ errors: [], predictions: [] });
            }
        };
        runAnalysis();
    }, [komatsuData, isConnected, isEngineRunning]);


    // Use the provided sensor data structure to generate meters
    const sensorKeysToRender = [
        'eng_wtr_temp', 'hyd_oil_temp', 'fuel_lvl', 'eng_oil_lvl',
        'rail_prs', 'rear_pump_prs', 'front_pump_prs', 'boost_prs',
        'arm_dig_prs', 'bucket_dig_prs', 'boom_up_prs', 'swing_left_prs',
        'travel_lf_prs', 'travel_rf_prs', 'ac_amb_temp', 'amb_air_prs',
        'arm_dump_prs', 'bucket_dump_prs', 'boom_down_prs', 'swing_right_prs',
        'travel_lr_prs', 'travel_rr_prs', 'sunshine_sen',
    ];

    // Group meters into sections for better readability
    const operationalSensors = sensorKeysToRender.slice(0, 6);
    const hydraulicPressures = sensorKeysToRender.slice(6, 12);
    const auxSensors = sensorKeysToRender.slice(12, 18);
    const remainingSensors = sensorKeysToRender.slice(18);

    const renderMeters = (keys) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
            {keys.map(key => {
                const meta = SENSOR_METADATA[key];
                return (
                    <SensorGauge
                        key={key}
                        name={meta.name}
                        value={komatsuData[key]}
                        unit={meta.unit}
                        max={meta.max}
                        color={meta.color}
                    />
                );
            })}
        </div>
    );

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
                <SidebarItem icon="🧭" label="Sensors" targetView="sensors" isActive={true} onNavigate={onNavigate} />
                <SidebarItem icon="🕹️" label="Simulation" targetView="simulation" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🔧" label="Maintenance" targetView="maintenance" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🔬" label="Analyze" targetView="analyze" isActive={false} onNavigate={onNavigate} />
                <div style={{ marginTop: 'auto', marginBottom: '20px' }}>
                    <SidebarItem icon="📋" label="Report" targetView="report" isActive={false} onNavigate={onNavigate} />
                </div>
            </nav>

            {/* Main Content Area - Full screen sensor display */}
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
                        Sensor Dashboard 🧭
                    </h1>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <div style={{
                            padding: '8px 15px',
                            backgroundColor: isConnected ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                            border: `1px solid ${isConnected ? '#28a745' : '#dc3545'}`,
                            color: isConnected ? '#28a745' : '#dc3545',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            backdropFilter: 'blur(10px)',
                            whiteSpace: 'nowrap'
                        }}>
                            Status: {isConnected ? 'Connected' : 'Disconnected'}
                        </div>

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

                {/* Full Screen Sensor Content Area */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'auto',
                    minHeight: 0,
                    padding: '20px'
                }}>

                    {/* Digital Status Flags */}
                    <div style={{
                        background: 'rgba(26, 26, 26, 0.9)',
                        borderRadius: '15px',
                        padding: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(15px)',
                        marginBottom: '20px'
                    }}>
                        <h2 style={{ textAlign: 'center', color: '#B0B0B0', marginBottom: '20px' }}>Digital Status Flags</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
                            <StatusIndicator label="Crank Sensor" value={komatsuData.crank_sen} />
                            <StatusIndicator label="Cam Sensor" value={komatsuData.cam_sen} />
                            <StatusIndicator label="Radiator Water Level" value={komatsuData.rad_wtr_lvl} />
                            <StatusIndicator label="Air Cleaner Clogged" value={komatsuData.air_cln_cld} />
                            <StatusIndicator label="Water in Fuel" value={komatsuData.wtr_in_fuel} />
                        </div>
                    </div>

                    {/* Engine Status Indicator */}
                    <div style={{
                        background: isEngineRunning ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                        border: `2px solid ${isEngineRunning ? '#28a745' : '#dc3545'}`,
                        borderRadius: '15px',
                        padding: '15px',
                        textAlign: 'center',
                        marginBottom: '20px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h3 style={{ color: isEngineRunning ? '#28a745' : '#dc3545', margin: 0 }}>
                            {isEngineRunning ? '✅ ENGINE RUNNING' : '⚠️ ENGINE OFF'}
                        </h3>
                    </div>

                    {/* --- Main Gauge Display (Switches based on engine state) --- */}
                    {isEngineRunning ? (
                        <div id="operational-gauges">
                            <h2 style={{ color: '#28a745', textAlign: 'center', margin: '20px 0' }}>
                                ✅ Operational Sensors
                            </h2>

                            <h3 style={{ color: '#E0E0E0', borderLeft: '4px solid #007BFF', paddingLeft: '10px', margin: '20px 0 10px 20px' }}>Engine & Fluid Levels</h3>
                            {renderMeters(operationalSensors)}

                            <h3 style={{ color: '#E0E0E0', borderLeft: '4px solid #DC3545', paddingLeft: '10px', margin: '20px 0 10px 20px' }}>Hydraulic System Pressures</h3>
                            {renderMeters(hydraulicPressures)}

                            <h3 style={{ color: '#E0E0E0', borderLeft: '4px solid #FFC107', paddingLeft: '10px', margin: '20px 0 10px 20px' }}>Travel & Auxiliary Sensors</h3>
                            {renderMeters(auxSensors)}

                            <h3 style={{ color: '#E0E0E0', borderLeft: '4px solid #17A2B8', paddingLeft: '10px', margin: '20px 0 10px 20px' }}>Remaining Pressures</h3>
                            {renderMeters(remainingSensors)}
                        </div>
                    ) : (
                        <div id="startup-screen" style={{
                            textAlign: 'center',
                            padding: '50px',
                            backgroundColor: '#333',
                            border: '2px solid #dc3545',
                            borderRadius: '10px',
                            color: '#F8F9FA',
                            margin: '20px'
                        }}>
                            <h2 style={{ color: '#dc3545' }}>⚠️ STANDBY MODE / ENGINE OFF</h2>
                            <p style={{ fontSize: '1.2em' }}>
                                Crank and Cam sensors are inactive. Full hydraulic monitoring is suppressed.
                            </p>
                        </div>
                    )}
                </div>
                {/* --- NEW SECTION: SIDEBAR NOTIFICATIONS --- */}
                {(health.errors.length > 0 || health.predictions.length > 0) && (
                    <div style={{
                        position: 'absolute',
                        right: '20px',
                        top: '80px',
                        width: '300px',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        zIndex: 1000
                    }}>
                        {/* Render Critical Errors */}
                        {health.errors.map((err, i) => (
                            <div key={`err-${i}`} style={{
                                padding: '12px', marginBottom: '10px', borderRadius: '8px',
                                backgroundColor: 'rgba(220, 53, 69, 0.2)', borderLeft: '5px solid #dc3545', color: '#fff'
                            }}>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#ff6b6b' }}>FAULT: {err.code}</div>
                                <div style={{ fontSize: '13px' }}>{err.msg}</div>
                            </div>
                        ))}

                    </div>
                )}
            </div>
        </div>
    );
};

export default MeterBoard;