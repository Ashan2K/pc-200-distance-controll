import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import autoTable from "jspdf-autotable";
import { SENSOR_KB } from "./sensorKnowledge";


import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement
} from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement);




// Trend analysis function with fault detection
const analyzeTrend = (sensorData) => {
    const n = sensorData.length;
    if (n < 2) return { trend: "No trend", alerts: [] };

    let xSum = 0, ySum = 0, xySum = 0, xxSum = 0;

    sensorData.forEach((d, i) => {
        xSum += i;
        ySum += d.value;
        xySum += i * d.value;
        xxSum += i * i;
    });

    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);

    // Detect anomalies based on sudden increases or high slope
    const alerts = [];
    sensorData.forEach((d, i) => {
        if (i === 0) return;
        const diff = d.value - sensorData[i - 1].value;
        if (Math.abs(diff) > 20) { // Adjust threshold based on sensor scale
            alerts.push({ index: i, value: d.value });
        }
    });

    let trendMsg = "Stable";
    if (slope > 0.05) trendMsg = "Increasing trend: Possible fault!";
    if (slope < -0.05) trendMsg = "Decreasing trend: Check sensor!";

    return { trend: trendMsg, alerts };
};

// Predict next N points using linear regression
const predictFuture = (data, steps = 6) => {
    if (data.length < 2) return [];

    const n = data.length;
    let xSum = 0, ySum = 0, xySum = 0, xxSum = 0;

    data.forEach((d, i) => {
        xSum += i;
        ySum += d.value;
        xySum += i * d.value;
        xxSum += i * i;
    });

    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;

    const predictions = [];
    for (let i = n; i < n + steps; i++) {
        predictions.push({
            index: i,
            value: +(slope * i + intercept).toFixed(2)
        });
    }

    return predictions;
};

const fetchLSTMPrediction = async (values) => {
    const res = await fetch('http://localhost:3000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
    });
    const data = await res.json();
    return Array.isArray(data) ? data : [];

};




// Sidebar component
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
            transition: 'color 0.2s, transform 0.2s, backgroundColor 0.2s',
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

const Analyze = ({ onNavigate }) => {
    const [sensors, setSensors] = useState(['eng_wtr_temp']);
    const [period, setPeriod] = useState('24h');
    const [sensorDataMap, setSensorDataMap] = useState({}); // { sensorName: [{timestamp, value}] }
    const [trends, setTrends] = useState({});
    const [alertsMap, setAlertsMap] = useState({});

    const [predictionsMap, setPredictionsMap] = useState({});
    const [faultWarnings, setFaultWarnings] = useState({});




    useEffect(() => {
        const fetchAll = async () => {
            const newPredictions = {};
            const newWarnings = {};


            for (let sensor of sensors) {
                const res = await fetch(
                    `http://localhost:3000/api/sensorData?sensor=${sensor}&period=${period}`
                );
                const data = await res.json();



                setSensorDataMap(prev => ({ ...prev, [sensor]: data }));

                const { trend, alerts } = analyzeTrend(data);

                setTrends(prev => ({ ...prev, [sensor]: trend }));
                setAlertsMap(prev => ({ ...prev, [sensor]: alerts }));

                const values = data.map(d => d.value);
                const preds = await fetchLSTMPrediction(values);

                const kb = SENSOR_KB[sensor];

                const denormalize = (norm, min, max) => {
                    return norm * (max - min) + min;
                };
                let denormPreds = preds;

                if (kb?.normal) {
                    denormPreds = preds.map(v =>
                        denormalize(v, kb.normal[0], kb.normal[1])
                    );
                }

                newPredictions[sensor] = denormPreds;



                if (kb && denormPreds.length) {
                    newWarnings[sensor] = denormPreds.some(v => {
                        if (kb.type === "upper") return v >= kb.critical;
                        if (kb.type === "lower") return v <= kb.warning;
                        if (kb.type === "range")
                            return v < kb.normal[0] || v > kb.normal[1];
                        return false;
                    });
                }


            }

            setPredictionsMap(newPredictions);
            setFaultWarnings(newWarnings);
        };

        fetchAll();
    }, [period]);




    const generatePDF = () => {
        const doc = new jsPDF();
        doc.text(`Multi-Sensor Data`, 14, 15);
        for (let sensor of sensors) {
            doc.text(sensor, 14, doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 20);
            autoTable(doc, {
                startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 25,
                head: [['Timestamp', 'Value']],
                body: (sensorDataMap[sensor] || []).map(d => [
                    new Date(d.timestamp).toLocaleString(),
                    d.value
                ]),
            });
        }
        doc.save(`multi_sensor_data.pdf`);
    };

    // Prepare chart data
    const allTimestamps = new Set();
    sensors.forEach(sensor => {
        (sensorDataMap[sensor] || []).forEach(d => allTimestamps.add(d.timestamp));
    });
    const sortedTimestamps = Array.from(allTimestamps).sort();

    const chartData = {
        labels: sortedTimestamps.map(ts => new Date(ts).toLocaleTimeString()),
        datasets: sensors.flatMap((sensor, idx) => {
            const realData = sensorDataMap[sensor] || [];
            const preds = predictionsMap[sensor] || [];

            return [
                {
                    label: sensor,
                    data: realData.map(d => d.value),
                    borderColor: `hsl(${idx * 60},70%,50%)`,
                    tension: 0.3
                },
                {
                    label: `${sensor} (LSTM Forecast)`,
                    data: [
                        ...Array(realData.length).fill(null),
                        ...(Array.isArray(predictionsMap[sensor]) ? predictionsMap[sensor] : [])
                    ],
                    borderDash: [5, 5],
                    borderColor: 'orange'
                }

            ];
        })

    };
    const toggleSensor = (sensorName) => {
        setSensors(prev =>
            prev.includes(sensorName)
                ? prev.filter(s => s !== sensorName)
                : [...prev, sensorName]
        );
    };




    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            backgroundColor: '#0A0A0A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'row',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            overflow: 'hidden'
        }}>
            {/* Sidebar */}
            <nav style={{
                width: '80px',
                background: 'rgba(26, 26, 26, 0.95)',
                borderRight: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '30px',
                flexShrink: 0
            }}>
                <SidebarItem icon="📊" label="Dashboard" targetView="dashboard" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🧭" label="Sensors" targetView="sensors" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🕹️" label="Simulation" targetView="simulation" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🔧" label="Maintenance" targetView="maintenance" isActive={false} onNavigate={onNavigate} />
                <SidebarItem icon="🔬" label="Analyze" targetView="analyze" isActive={true} onNavigate={onNavigate} />
                <div style={{ marginTop: 'auto', marginBottom: '20px' }}>
                    <SidebarItem icon="📊" label="Report" targetView="report" isActive={false} />
                </div>
            </nav>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px 25px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(26, 26, 26, 0.85)',
                    backdropFilter: 'blur(10px)',
                    flexShrink: 0
                }}>
                    <h1 style={{
                        fontSize: '1.8rem',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        margin: 0
                    }}>Analyze Sensors 🔬</h1>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: '20px', padding: '20px', overflowY: 'auto' }}>
                    {/* Controls */}
                    <div style={{
                        backgroundColor: 'rgba(26,26,26,0.9)',
                        borderRadius: '15px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ marginBottom: '15px', color: '#B0B0B0', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            <div>
                                <label>Period: </label>
                                <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
                                    <option value="1h">Last 1 Hour</option>
                                    <option value="24h">Last 24 Hours</option>
                                    <option value="7d">Last 7 Days</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {['eng_wtr_temp', 'bucket_dump_prs', 'fuel_lvl', 'arm_dig_prs', 'travel_lf_prs'].map(s => (
                                    <label key={s} style={{ cursor: 'pointer' }}>
                                        <input type="checkbox" checked={sensors.includes(s)} onChange={() => toggleSensor(s)} />
                                        {s}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <Line data={chartData} />
                        <div style={{
                            backgroundColor: 'rgba(26,26,26,0.9)',
                            borderRadius: '15px',
                            padding: '20px'
                        }}>
                            <h2 style={{ color: '#B0B0B0' }}>Prediction Alerts</h2>

                            {Object.keys(faultWarnings).length === 0 && (
                                <p>No prediction data</p>
                            )}

                            {Object.entries(faultWarnings).map(([sensor, isFault]) => (
                                <div key={sensor} style={{
                                    color: isFault ? 'red' : '#20c997',
                                    marginBottom: '8px',
                                    fontWeight: '600'
                                }}>
                                    {isFault
                                        ? `⚠ ${sensor} likely to FAIL within next hour`
                                        : `✓ ${sensor} stable`}



                                </div>
                            ))}
                        </div>

                    </div>

                    {/* PDF Table */}
                    <div style={{
                        backgroundColor: 'rgba(26,26,26,0.9)',
                        borderRadius: '15px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <h2 style={{ color: '#B0B0B0' }}>Sensor Data Table</h2>
                            <button onClick={generatePDF} style={{
                                padding: '8px 12px', borderRadius: '6px', border: 'none',
                                backgroundColor: '#20c997', color: '#fff', cursor: 'pointer'
                            }}>Download PDF</button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #555' }}>
                                        <th style={thTdStyle}>Timestamp</th>
                                        {sensors.map(s => <th key={s} style={thTdStyle}>{s}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTimestamps.map((ts, idx) => (
                                        <tr key={idx} style={{
                                            borderBottom: '1px solid #333',
                                            backgroundColor: sensors.some(s => (alertsMap[s] || []).some(a => a.index === idx)) ? 'rgba(255,0,0,0.1)' : 'transparent'
                                        }}>
                                            <td style={thTdStyle}>{new Date(ts).toLocaleString()}</td>
                                            {sensors.map(s => {
                                                const rec = (sensorDataMap[s] || []).find(d => d.timestamp === ts);
                                                return <td key={s} style={{
                                                    ...thTdStyle,
                                                    color: (alertsMap[s] || []).some(a => a.index === idx) ? 'red' : '#fff'
                                                }}>{rec ? rec.value : '-'}</td>
                                            })}
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        </div>
                    </div>

                    {/* Trend Analysis */}
                    <div style={{
                        backgroundColor: 'rgba(26,26,26,0.9)',
                        borderRadius: '15px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <h2 style={{ color: '#B0B0B0' }}>Trend Analysis</h2>
                        {sensors.map(s => (
                            <div key={s} style={{ marginBottom: '10px' }}>
                                <strong>{s}:</strong> {trends[s]}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const selectStyle = {
    marginLeft: '5px', padding: '5px', borderRadius: '6px',
    backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #444'
};

const thTdStyle = {
    padding: '8px',
    textAlign: 'left',
    fontSize: '12px'
};

export default Analyze;
