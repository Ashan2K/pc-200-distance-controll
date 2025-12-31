import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    const generatePDF = (data, isHistory = false) => {
        const doc = new jsPDF();
        const timestamp = new Date().toLocaleString();

        // Header Section
        doc.setFillColor(26, 26, 26);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(32, 201, 151); 
        doc.setFontSize(22);
        doc.text("KOMATSU DIAGNOSTIC REPORT", 15, 25);
        
        // 2. Use autoTable(doc, { ... }) instead of doc.autoTable({ ... })
        const details = [
            ["Fault Code", data.code],
            ["Description", data.message],
            ["Sensor Involved", data.sensor],
            ["Start Time", new Date(data.startedAt).toLocaleString()],
        ];

        if (isHistory) {
            details.push(["End Time", new Date(data.endedAt).toLocaleString()]);
            details.push(["Total Duration", `${Math.floor(data.durationSec / 60)}m ${Math.floor(data.durationSec % 60)}s`]);
        }

        autoTable(doc, {
            startY: 55,
            head: [['Property', 'Value']],
            body: details,
            theme: 'striped',
            headStyles: { fillColor: [32, 201, 151] }
        });

        // Machine Snapshot Section
        const snapshot = isHistory ? data.lastSnapshot : data.snapshot;
        if (snapshot) {
            const finalY = doc.lastAutoTable.finalY;
            doc.setTextColor(0, 0, 0);
            doc.text("Machine State Snapshot", 15, finalY + 15);
            
            const sensorData = Object.entries(snapshot)
                .filter(([key]) => typeof snapshot[key] !== 'object') 
                .map(([key, value]) => [key, value]);

            autoTable(doc, {
                startY: finalY + 20,
                head: [['Sensor Name', 'Reading']],
                body: sensorData,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [100, 100, 100] }
            });
        }

        doc.save(`Report_${data.code}_${Date.now()}.pdf`);
    };


    // --- SHARED STYLES ---
    const cardStyle = {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        borderRadius: '20px',
        padding: '25px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(15px)',
        boxShadow: '0 15px 30px rgba(0, 0, 0, 0.5)',
        marginBottom: '30px'
    };

    const tableHeaderStyle = { color: '#20c997', borderBottom: '2px solid rgba(32, 201, 151, 0.3)', padding: '12px', textAlign: 'left', fontSize: '0.8rem', textTransform: 'uppercase' };
    const tableCellStyle = { padding: '15px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.85rem', color: '#e0e0e0' };
    const btnStyle = { backgroundColor: '#20c997', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' };

    const SidebarItem = ({ icon, label, targetView, isActive = false }) => (
        <div onClick={() => onNavigate(targetView)} style={{ cursor: 'pointer', color: isActive ? '#20c997' : '#fff', marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px', borderRadius: '8px', backgroundColor: isActive ? 'rgba(32, 201, 151, 0.1)' : 'transparent', transition: 'all 0.2s' }}>
            <span style={{ fontSize: '1.7rem' }}>{icon}</span>
            <span style={{ fontSize: '0.75rem', marginTop: '3px' }}>{label}</span>
        </div>
    );

    return (
        <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0A0A0A', color: '#fff', display: 'flex', overflow: 'hidden' }}>
            <nav style={{ width: '80px', background: 'rgba(26, 26, 26, 0.95)', borderRight: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '30px', zIndex: 20 }}>
                <SidebarItem icon="📊" label="Dashboard" targetView="dashboard" isActive={true} />
                <SidebarItem icon="🧭" label="Sensors" targetView="sensors" isActive={false} />
                <SidebarItem icon="🕹️" label="Simulation" targetView="simulation" isActive={false} />
                <SidebarItem icon="🔧" label="Maintenance" targetView="maintenance" isActive={false} />
                <SidebarItem icon="🔬" label="Analyze" targetView="analyze" isActive={false} onNavigate={onNavigate} />
                <div style={{ marginTop: 'auto', marginBottom: '20px' }}>
                    <SidebarItem icon="📋" label="Report" targetView="report" isActive={true} />
                </div>
            </nav>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '30px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '30px', color: '#20c997' }}>Machine Health Reports 🔬</h1>

                {loading ? <p>Synchronizing...</p> : (
                    <>
                        <div style={cardStyle}>
                            <h3 style={{ color: '#dc3545', marginBottom: '20px' }}>🔴 Active Machine Faults</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>Code</th>
                                        <th style={tableHeaderStyle}>Message</th>
                                        <th style={tableHeaderStyle}>Impact Time</th>
                                        <th style={tableHeaderStyle}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeErrors.length === 0 ? (
                                        <tr><td colSpan="4" style={{ ...tableCellStyle, textAlign: 'center' }}>No active faults.</td></tr>
                                    ) : (
                                        activeErrors.map(err => (
                                            <tr key={err.code}>
                                                <td style={{ ...tableCellStyle, fontWeight: 'bold', color: '#dc3545' }}>{err.code}</td>
                                                <td style={tableCellStyle}>{err.message}</td>
                                                <td style={tableCellStyle}>{new Date(err.startedAt).toLocaleString()}</td>
                                                <td style={tableCellStyle}>
                                                    <button onClick={() => generatePDF(err, false)} style={btnStyle}>PDF</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={cardStyle}>
                            <h3 style={{ color: '#20c997', marginBottom: '20px' }}>📜 Resolved History</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>Fault</th>
                                        <th style={tableHeaderStyle}>Resolution</th>
                                        <th style={tableHeaderStyle}>Duration</th>
                                        <th style={tableHeaderStyle}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(item => (
                                        <tr key={item.id}>
                                            <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{item.code}</td>
                                            <td style={tableCellStyle}>{item.message}</td>
                                            <td style={{ ...tableCellStyle, color: '#ffc107' }}>
                                                {Math.floor(item.durationSec / 60)}m {Math.floor(item.durationSec % 60)}s
                                            </td>
                                            <td style={tableCellStyle}>
                                                <button onClick={() => generatePDF(item, true)} style={btnStyle}>PDF</button>
                                            </td>
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