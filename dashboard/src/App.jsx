import React, { useState } from 'react';
import LoginPage from './login.jsx';
import Dashboard from './dashboard.jsx';
import MeterBoard from './meter_board.jsx';
import JcbArmSimulator from './jcb_swign.jsx';
import Maintenance from './Maintenance.jsx';
import Analyze from './Analyze.jsx';
import './App.css';
import ReportPage from './report.jsx';

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);

  const handleLogin = (username) => {
    setUser(username);
    setCurrentView('sensors');
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
  };

  return (
    <div className="App">
      {currentView === 'login' && <LoginPage onLogin={handleLogin} />}
      {currentView === 'utility' && <Dashboard onNavigate={handleNavigate} onLogout={handleLogout} />}
      {currentView === 'sensors' && <MeterBoard onNavigate={handleNavigate} />}
      {currentView === 'simulation' && <JcbArmSimulator onNavigate={handleNavigate} />}
      {currentView === 'maintenance' && <Maintenance onNavigate={handleNavigate}/>}
      {currentView === 'analyze' && <Analyze onNavigate={handleNavigate} />}
      {currentView === 'report' && <ReportPage onNavigate={handleNavigate} />}



      {currentView === 'settings' && <div>Settings View</div>}
    </div>
  );
}

export default App;