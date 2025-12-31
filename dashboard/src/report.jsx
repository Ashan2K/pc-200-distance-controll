import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ReportPage = ({ onNavigate = () => { } }) => {
    const [activeErrors, setActiveErrors] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

  
    const API_BASE = `http://localhost:3000/api`;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [activeRes, historyRes] = await Promise.all([
                    axios.get(`${API_BASE}/active-errors`),
                    axios.get(`${API_BASE}/error-history`)
                ]);
                setActiveErrors(activeRes.data);
                setHistory(historyRes.data);
            } catch (err) {
                console.error("Failed to load reports:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- SHARED STYLES FROM DASHBOARD ---
    const cardStyle = {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        borderRadius: '20px',
        padding: '25px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(15px)',
        boxShadow: '0 15px 30px rgba(0, 0, 0, 0.5)',
        marginBottom: '30px'
    };

    const tableHeaderStyle = {
        color: '#20c997',
        borderBottom: '2px solid rgba(32, 201, 151, 0.3)',
        padding: '12px',
        textAlign: 'left',
        fontSize: '0.9rem',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    };

    const tableCellStyle = {
        padding: '15px 12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '0.85rem',
        color: '#e0e0e0'
    };

    const SidebarItem = ({ icon, label, targetView, isActive = false }) => (
        <div
            onClick={() => onNavigate(targetView)}
            style={{
                cursor: 'pointer',
                color: isActive ? '#20c997' : '#fff',
                marginBottom: '30px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '5px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'rgba(32, 201, 151, 0.1)' : 'transparent',
                transition: 'all 0.2s'
            }}
        >
            <span style={{ fontSize: '1.7rem' }}>{icon}</span>
            <span style={{ fontSize: '0.75rem', marginTop: '3px' }}>{label}</span>
        </div>
    );

    return (
        <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0A0A0A', color: '#fff', display: 'flex', overflow: 'hidden' }}>
            
            {/* Sidebar (Reused) */}
            <nav style={{ width: '80px', background: 'rgba(26, 26, 26, 0.95)', borderRight: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '30px', zIndex: 20 }}>
                <SidebarItem icon="📊" label="Dashboard" targetView="dashboard" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🧭" label="Sensors" targetView="sensors" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🕹️" label="Simulation" targetView="simulation" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🔧" label="Maintenance" targetView="maintenance" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🔬" label="Analyze" targetView="analyze" isActive={false} onNavigate={onNavigate} />
                <div style={{ marginTop: 'auto', marginBottom: '20px' }}>
                    <SidebarItem icon="📋" label="Report" targetView="report" isActive={true} />
                </div>
            </nav>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '30px', position: 'relative' }}>
                
                {/* Background Pattern */}
                <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(32, 201, 151, 0.05) 0%, transparent 50%)', zIndex: -1 }}></div>

                <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '30px', background: 'linear-gradient(135deg, #20c997 0%, #007bff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Machine Health Reports 🔬
                </h1>

                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: '100px', color: '#20c997' }}>Synchronizing with Machine Database...</div>
                ) : (
                    <>
                        {/* 1. ACTIVE ERRORS TABLE */}
                        <div style={cardStyle}>
                            <div style={{ position: 'absolute', inset: '-1px', background: 'linear-gradient(45deg, rgba(220,53,69,0.3), transparent)', borderRadius: '20px', zIndex: -1 }}></div>
                            <h3 style={{ color: '#dc3545', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                🔴 Active Machine Faults
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>Code</th>
                                        <th style={tableHeaderStyle}>Message</th>
                                        <th style={tableHeaderStyle}>Sensor</th>
                                        <th style={tableHeaderStyle}>Impact Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeErrors.length === 0 ? (
                                        <tr><td colSpan="4" style={{...tableCellStyle, textAlign: 'center', padding: '40px'}}>System Nominal: No active faults.</td></tr>
                                    ) : (
                                        activeErrors.map(err => (
                                            <tr key={err.code}>
                                                <td style={{...tableCellStyle, fontWeight: 'bold', color: '#dc3545'}}>{err.code}</td>
                                                <td style={tableCellStyle}>{err.message}</td>
                                                <td style={tableCellStyle}>{err.sensor}</td>
                                                <td style={tableCellStyle}>{new Date(err.startedAt).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 2. HISTORY TABLE */}
                        <div style={cardStyle}>
                            <h3 style={{ color: '#20c997', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                📜 Resolved Diagnostics History
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>Fault</th>
                                        <th style={tableHeaderStyle}>Resolution</th>
                                        <th style={tableHeaderStyle}>Duration</th>
                                        <th style={tableHeaderStyle}>Started</th>
                                        <th style={tableHeaderStyle}>Resolved</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(item => (
                                        <tr key={item.id}>
                                            <td style={{...tableCellStyle, fontWeight: 'bold'}}>{item.code}</td>
                                            <td style={tableCellStyle}>{item.message}</td>
                                            <td style={{...tableCellStyle, color: '#ffc107'}}>
                                                {Math.floor(item.durationSec / 60)}m {Math.floor(item.durationSec % 60)}s
                                            </td>
                                            <td style={tableCellStyle}>{new Date(item.startedAt).toLocaleString()}</td>
                                            <td style={tableCellStyle}>{new Date(item.endedAt).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReportPage;