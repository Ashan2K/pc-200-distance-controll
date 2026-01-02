// ...imports remain the same
import { React, useEffect, useState, useRef } from 'react';
import useWebSocket from './useWebSocket';
import { analyzeMachineHealth } from './diagnosisEngine';
import baseUrl from './baseUrl.js';

const Dashboard = ({ onNavigate = () => { } }) => {
  // WebSocket for live data
  const SERVER_IP = baseUrl;
  const PORT_KOMATSU = 8081;
  const controls = useWebSocket(`ws://${SERVER_IP}:${PORT_KOMATSU}`);
  const gps = controls?.gps;

  // State for map stability
  const [mapUrl, setMapUrl] = useState('');
  const mapRef = useRef(null);
  const [dashboardErrors, setDashboardErrors] = useState([]);

 useEffect(() => {
  const runDiagnostics = async () => {
    if (controls) {
      try {
        // Await the async diagnostic result
        const result = await analyzeMachineHealth(controls);
        
        // Ensure result and result.errors are defined before updating state
        if (result && result.errors) {
          setDashboardErrors(result.errors);
        } else {
          setDashboardErrors([]);
        }
      } catch (err) {
        console.error("Diagnostic analysis failed:", err);
        setDashboardErrors([]);
      }
    }
  };

  runDiagnostics();
}, [controls]);



  useEffect(() => {
    if (gps && gps.lat && gps.lon) {
      const newMapUrl = `https://maps.google.com/maps?q=${gps.lat},${gps.lon}&z=15&output=embed`;
      setMapUrl(newMapUrl);
    }
  }, [gps?.lat, gps?.lon]);

  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const vehicles = [
    { id: 1, name: 'Komatsu PC200-8' },
    { id: 2, name: 'JCB JS220' },
    { id: 3, name: 'CAT 320D' },
  ];

  const cardStyle = {
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(15px)',
    boxShadow: '0 15px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    willChange: 'transform, box-shadow',
    minHeight: 0,
  };

  const handleMouseEnter = (e) => {
    e.currentTarget.style.transform = 'translateY(-3px)';
    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
  };

  const SidebarItem = ({ icon, label, targetView, isActive = false }) => (
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
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.color = '#20c997'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = isActive ? '#20c997' : '#fff'; }}
      title={label}
    >
      <span style={{ fontSize: '1.7rem' }}>{icon}</span>
      <span style={{ fontSize: '0.75rem', marginTop: '3px', fontWeight: '500' }}>{label}</span>
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

      {/* Background Pattern */}
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

      {/* Sidebar */}
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
        <SidebarItem icon="🧭" label="Sensors" targetView="sensors" isActive={false} />
        <SidebarItem icon="🕹️" label="Simulation" targetView="simulation" isActive={false} />
        <SidebarItem icon="🔧" label="Maintenance" targetView="maintenance" isActive={false} />
        <SidebarItem icon="🔬" label="Analyze" targetView="analyze" isActive={false} onNavigate={onNavigate} />
        <SidebarItem icon="📊" label="Utility" targetView="utility" isActive={false} onNavigate={onNavigate} />
        <div style={{ marginTop: 'auto', marginBottom: '20px' }}>
          <SidebarItem icon="📋" label="Report" targetView="report" isActive={false} />
        </div>
      </nav>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
        minWidth: 0
      }}>

        {/* Header */}
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
            Hi, Welcome! 🚀
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button onClick={() => setShowVehicleModal(true)} style={{
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
              {[{ icon: '🔍', tooltip: 'Search' }, { icon: '🔔', tooltip: 'Notifications' }, { icon: '👤', tooltip: 'Profile' }].map((item, index) => (
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

        {/* Main Grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '20px',
          padding: '20px',
          position: 'relative',
          overflow: 'auto',
          minHeight: 0,
          boxSizing: 'border-box'
        }}>

          {/* Promotion Card (replaces Vehicle Running Time) */}
          <div style={{ ...cardStyle, gridColumn: '1', gridRow: '1', minWidth: 0 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}>
            <div style={{ position: 'absolute', inset: '-2px', background: 'linear-gradient(45deg, #ff6b6b, #feca57, #48dbfb)', borderRadius: '22px', zIndex: -1, opacity: 0.3 }}></div>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: '#e0e0e0', fontWeight: '600' }}>Promotions 📢</h3>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '8px' }}>Current Promotions:</div>
              <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: '#ccc', fontSize: '0.85rem' }}>
                <li>50% off on Hydraulic Service</li>
                <li>Free Oil Check for December</li>
              </ul>
              <button style={{
                marginTop: 'auto',
                backgroundColor: '#20c997',
                border: 'none',
                padding: '10px',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer'
              }}
                onClick={() => alert('Create Promotion')}>
                ➕ Create Promotion
              </button>
            </div>
          </div>

          {/* Live Location Card */}
          <div style={{ ...cardStyle, gridColumn: '1', gridRow: '2', minWidth: 0 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}>
            <div style={{ position: 'absolute', inset: '-2px', background: 'linear-gradient(45deg, #17a2b8, #20c997, #28a745)', borderRadius: '22px', zIndex: -1, opacity: 0.3 }}></div>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#e0e0e0', fontWeight: '600' }}>Live Location 📍</h3>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {gps ? (
                <>
                  <div style={{ flex: 1, minHeight: '150px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
                    {mapUrl && (
                      <iframe
                        ref={mapRef}
                        key={mapUrl}
                        title="Live Map"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        src={mapUrl}
                        allowFullScreen
                        style={{ border: 'none', background: '#1a1a1a' }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#b0b0b0' }}>
                    Lat: <span style={{ color: '#fff', fontWeight: '500' }}>{gps.lat?.toFixed(5) || 'N/A'}</span>,
                    Lon: <span style={{ color: '#fff', fontWeight: '500' }}>{gps.lon?.toFixed(5) || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888' }}>
                    <span>Speed: {gps.speed || '0'} m/s</span>
                    <span>Altitude: {gps.alt || '0'} m</span>
                    <span>Sats: {gps.sats || '0'}</span>
                  </div>
                </>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888',
                  fontSize: '0.9rem',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '8px',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div>Waiting for location data...</div>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>
                    Ensure GPS is connected and sending data
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Errors & Predictive Maintenance - Full right column */}
          <div style={{ ...cardStyle, gridColumn: '2 / 3', gridRow: '1 / 3', padding: '15px 20px', minWidth: 0 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}>
            <div style={{ position: 'absolute', inset: '-2px', background: 'linear-gradient(45deg, #dc3545, #ffc107, #28a745)', borderRadius: '22px', zIndex: -1, opacity: 0.3 }}></div>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: '#e0e0e0', fontWeight: '600' }}>
              Errors & Predictive Maintenance 🚨
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ fontSize: '0.85rem', color: '#dc3545', marginBottom: '8px', fontWeight: '600', borderBottom: '1px dashed #dc3545', paddingBottom: '4px', whiteSpace: 'nowrap' }}>Critical Errors</h4>
                <div className="error-card">
                  {dashboardErrors.length === 0 ? (
                    <p>No errors</p>
                  ) : (
                    dashboardErrors.map((err, i) => (
                      <div key={i} style={{
                        backgroundColor: 'rgba(220,53,69,0.2)',
                        borderLeft: '5px solid #dc3545',
                        padding: '10px',
                        marginBottom: '10px',
                        borderRadius: '5px'
                      }}>
                        <strong>FAULT: {err.code}</strong>
                        <p>{err.msg}</p>
                      </div>
                    ))
                  )}
                </div>


              </div>

              <div style={{ minWidth: 0 }}>
                <h4 style={{ fontSize: '0.85rem', color: '#ffc107', marginBottom: '8px', fontWeight: '600', borderBottom: '1px dashed #ffc107', paddingBottom: '4px', whiteSpace: 'nowrap' }}>Upcoming Predictions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['Check Your EPC Block', 'Check Your Hydraulic Level'].map((prediction, index) => (
                    <div key={index} style={{ padding: '6px', backgroundColor: '#1a1a1a', borderRadius: '5px', border: '1px solid #ffc107', fontSize: '11px', minWidth: 0 }}>
                      <span style={{ color: '#ffc107', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>⚠️ {prediction}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Vehicle Modal */}
      {showVehicleModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            width: '350px',
            background: 'rgba(26,26,26,0.95)',
            borderRadius: '14px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(12px)'
          }}>
            <h3 style={{ marginBottom: '15px', color: '#20c997' }}>
              Select Vehicle 🚜
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {vehicles.map(v => (
                <div
                  key={v.id}
                  onClick={() => { console.log('Selected:', v); setShowVehicleModal(false); }}
                  style={{
                    padding: '10px',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: '1px solid #333',
                    color: '#fff'
                  }}
                >
                  {v.name}
                </div>
              ))}
            </div>
            <button
              onClick={() => alert('Add New Vehicle')}
              style={{
                marginTop: '15px',
                width: '100%',
                background: '#20c997',
                border: 'none',
                padding: '10px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ Add New Vehicle
            </button>
            <button
              onClick={() => setShowVehicleModal(false)}
              style={{
                marginTop: '8px',
                width: '100%',
                background: 'transparent',
                color: '#aaa',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
