import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import reactLogo from "./assets/react.svg";
import { Search, Wrench, AlertTriangle, Camera, Home, BarChart2, Settings } from "lucide-react";
import CameraPage from "./camera";
import "./App.css";

// 1. We move the Tauri boilerplate into the HomePage so it doesn't clutter the other tabs!
const HomePage = () => {};

// 2. Simple placeholder components
const DashboardPage = ({ robotMode, setRobotMode, isInspecting }) => (
  <div className="dashboard-container">
    <div className="mode-selector" style={{ marginBottom: '24px' }}>
      <label htmlFor="robot-mode" className="mode-label">Robot Mode:</label>
      <select
        id="robot-mode"
        value={robotMode}
        onChange={(e) => setRobotMode(e.target.value)}
        className={`mode-select ${robotMode}`}
        disabled={isInspecting}
      >
        <option value="standby">Standby</option>
        <option value="inspection">Inspection</option>
        <option value="maintenance">Maintenance</option>
      </select>
    </div>

    <div className="mode-content">
      {robotMode === 'inspection' && (
        <div className="menu-placeholder">
          <h3><Search size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Inspection Menu</h3>
          <p>Controls and sensors for inspection mode will appear here.</p>
        </div>
      )}
      {robotMode === 'maintenance' && (
        <div className="maintenance-menu">
          <h3><Wrench size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Maintenance Tasks</h3>
          <div className="task-grid">
            <button className="task-button" onClick={() => {}}>1. Tile Replace</button>
            <button className="task-button" onClick={() => {}}>2. Radiation Cleaning</button>
            <button className="task-button" onClick={() => {}}>3. Magnet Removal</button>
            <button className="task-button" onClick={() => {}}>4. Manual Operator Control</button>
          </div>
        </div>
      )}
    </div>
  </div>
);
const SettingsPage = () => <div className="placeholder"><h2>Settings</h2></div>;

// 3. The Main App Container
export default function App() {
  const [activeTab, setActiveTab] = useState('camera');
  const [robotMode, setRobotMode] = useState('standby');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionTimeLeft, setInspectionTimeLeft] = useState(0);

  const handleSetRobotMode = (mode) => {
    if (isInspecting) return;
    setRobotMode(mode);
    if (mode === 'inspection') {
      setIsInspecting(true);
      setInspectionTimeLeft(5); // 5 sec inspection timer
      setActiveTab('camera');
    }
  };

  useEffect(() => {
    let timerId;
    if (isInspecting && inspectionTimeLeft > 0) {
      timerId = setTimeout(() => setInspectionTimeLeft(inspectionTimeLeft - 1), 1000);
    } else if (isInspecting && inspectionTimeLeft === 0) {
      setIsInspecting(false);
      setRobotMode('standby');
    }
    return () => clearTimeout(timerId);
  }, [isInspecting, inspectionTimeLeft]);

  // Router function to render the correct component
  const renderContent = () => {
    switch (activeTab) {
      case 'camera': return <CameraPage />;
      case 'home': return <HomePage />;
      case 'dashboard': return <DashboardPage robotMode={robotMode} setRobotMode={handleSetRobotMode} isInspecting={isInspecting} />;
      case 'settings': return <SettingsPage />;
      default: return <CameraPage />;
    }
  };

  return (
    <main className="app-container">
      {/* App Header */}
      <header className="app-header" style={{ display: 'flex', alignItems: 'center' }}>
        <h2 className="app-title">Robot Control</h2>
        {isInspecting && (
          <div className="inspection-banner" style={{ background: '#eab308', color: '#000', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}><AlertTriangle size={18} /></span>
            Inspecting... {inspectionTimeLeft}s
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="content-area">
        {renderContent()}
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="homebar">
        <button
          className={activeTab === 'camera' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('camera')}
          disabled={isInspecting}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Camera size={18} /> Camera</span>
        </button>
        <button
          className={activeTab === 'home' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('home')}
          disabled={isInspecting}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Home size={18} /> Home</span>
        </button>
        <button
          className={activeTab === 'dashboard' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('dashboard')}
          disabled={isInspecting}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><BarChart2 size={18} /> Dash</span>
        </button>
        <button
          className={activeTab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('settings')}
          disabled={isInspecting}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Settings size={18} /> Settings</span>
        </button>
      </nav>
    </main>
  );
}
