import React, { useState, useEffect } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Sidebar Item Component
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

// Input Field Component
const InputField = ({ label, name, value, onChange, type = "text" }) => (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
        <label style={{ fontSize: '12px', marginBottom: '3px', color: '#B0B0B0' }}>{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            style={inputStyle}
        />
    </div>
);

const Maintenance = ({ onNavigate }) => {
    const [selectedIds, setSelectedIds] = useState([]);

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const generatePDF = () => {
        const doc = new jsPDF();

        const selectedRecords = records.filter(r => selectedIds.includes(r.id));

        if (selectedRecords.length === 0) {
            alert("Please select at least one record to export.");
            return;
        }

        const tableColumn = ["Part No", "Part Name", "Replace Date", "Reason", "Technician Notes"];
        const tableRows = selectedRecords.map(record => [
            record.partNo,
            record.partName,
            record.replaceDate,
            record.reason,
            record.notes
        ]);

        doc.setFontSize(18);
        doc.text("Selected Maintenance Records", 14, 22);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [32, 201, 151] },
            styles: { fontSize: 10 }
        });

        doc.save("selected_maintenance_records.pdf");
    };
    const [form, setForm] = useState({
        partNo: '',
        partName: '',
        replaceDate: '',
        reason: '',
        notes: ''
    });
    const [records, setRecords] = useState([]);

    // --- Fetch records from backend ---
    const fetchRecords = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/maintenance');
            const data = await res.json();
            setRecords(data);
        } catch (err) {
            console.error('Error fetching records:', err);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.partNo || !form.partName || !form.replaceDate) return;

        try {
            const res = await fetch('http://localhost:3000/api/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setForm({ partNo: '', partName: '', replaceDate: '', reason: '', notes: '' });
                fetchRecords(); // Refresh table after submission
            }
        } catch (err) {
            console.error('Error adding record:', err);
        }
    };

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            backgroundColor: '#0A0A0A',
            color: '#ffffff',
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
                <SidebarItem icon="🔧" label="Maintenance" targetView="maintenance" isActive={true} onNavigate={onNavigate} />
                <SidebarItem icon="🔬" label="Analyze" targetView="analyze" isActive={false} onNavigate={onNavigate} />
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
                    }}>Maintenance 🔧</h1>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px', overflowY: 'auto' }}>
                    {/* Form */}
                    <div style={{
                        backgroundColor: 'rgba(26,26,26,0.9)',
                        borderRadius: '15px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <h2 style={{ marginBottom: '15px', color: '#B0B0B0' }}>Add Maintenance Record</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                            <InputField label="Part No" name="partNo" value={form.partNo} onChange={handleChange} />
                            <InputField label="Part Name" name="partName" value={form.partName} onChange={handleChange} />
                            <InputField label="Replace Date" name="replaceDate" type="date" value={form.replaceDate} onChange={handleChange} />
                            <InputField label="Reason for Replace" name="reason" value={form.reason} onChange={handleChange} />
                            <InputField label="Technician Notes" name="notes" value={form.notes} onChange={handleChange} />
                            <button type="submit" style={{
                                padding: '10px', borderRadius: '6px', border: 'none', marginTop: '10px',
                                backgroundColor: '#20c997', color: '#fff', fontWeight: '600', cursor: 'pointer'
                            }}>Add Record</button>
                        </form>
                    </div>

                    {/* Table */}
                    <div style={{
                        backgroundColor: 'rgba(26,26,26,0.9)',
                        borderRadius: '15px',
                        padding: '20px',
                        overflowY: 'auto'
                    }}>
                        <h2 style={{ marginBottom: '15px', color: '#B0B0B0' }}>Maintenance Records</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #555' }}>
                                    <th style={thTdStyle}>Selecte</th>
                                    <th style={thTdStyle}>Part No</th>
                                    <th style={thTdStyle}>Part Name</th>
                                    <th style={thTdStyle}>Replace Date</th>
                                    <th style={thTdStyle}>Reason</th>
                                    <th style={thTdStyle}>Technician Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '10px', color: '#888' }}>No records found</td>
                                    </tr>
                                )}
                                {records.map(rec => (
                                    <tr key={rec.id} style={{ borderBottom: '1px solid #333' }}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(rec.id)}
                                                onChange={() => toggleSelect(rec.id)}
                                            />
                                        </td>
                                        <td style={thTdStyle}>{rec.partNo}</td>
                                        <td style={thTdStyle}>{rec.partName}</td>
                                        <td style={thTdStyle}>{rec.replaceDate}</td>
                                        <td style={thTdStyle}>{rec.reason}</td>
                                        <td style={thTdStyle}>{rec.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={generatePDF} style={{
                            padding: '8px 12px',
                            backgroundColor: '#20c997',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginTop: '10px'
                        }}>
                            Download Selected
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
};

const inputStyle = {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #444',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    marginBottom: '5px'
};

const thTdStyle = {
    padding: '8px',
    textAlign: 'left',
    fontSize: '12px'
};

export default Maintenance;
