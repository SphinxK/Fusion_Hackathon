import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import reactLogo from "./assets/react.svg";
import { Search, Wrench, AlertTriangle, Camera, Home, BarChart2, Settings } from "lucide-react";
import CameraPage from "./camera";
import ArmSimulation from "./ArmSimulation";
import AiTrainingPage from './AiTrainingPage';
import "./App.css";

const HomePage = () => {
  const [az, setAz] = useState(0);
  const [th2, setTh2] = useState(-45);
  const [th3, setTh3] = useState(60);
  const [d1, setD1] = useState(10);
  const [a1, setA1] = useState(5);
  const [a2, setA2] = useState(4);
  const [a3, setA3] = useState(2);
  const [activeTool, setActiveTool] = useState(1);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ width: '250px', backgroundColor: '#2a2a35', padding: '20px', borderRight: '1px solid #444', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#fff' }}>Tool Heads</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 1, name: '1. Laser Duster' },
            { id: 2, name: '2. Claw' },
            { id: 3, name: '3. Drill' }
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              style={{
                padding: '12px',
                background: activeTool === tool.id ? '#4c99f2' : '#3c3c4a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: activeTool === tool.id ? 'bold' : 'normal',
                transition: 'background 0.2s'
              }}
            >
              {tool.name}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Visualizer Container */}
      <div style={{ flex: 1, backgroundColor: '#1a1a1a', position: 'relative' }}>
        <ArmSimulation
          az={az} th2={th2} th3={th3}
          d1={d1} a1={a1} a2={a2} a3={a3}
        />
        <div style={{ position: 'absolute', top: 16, left: 16, color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
          3-DOF Inverted Arm Simulation
        </div>
      </div>

      {/* Control Panel */}
      <div style={{ width: '300px', backgroundColor: '#2a2a35', padding: '20px', overflowY: 'auto', borderLeft: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#fff' }}>Simulation Controls</h3>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#4c99f2', margin: '0 0 10px 0' }}>Joint Angles</h4>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', fontSize: '0.9rem', marginBottom: '4px' }}>
              <label>Joint 1 (Azimuth)</label>
              <span>{az}°</span>
            </div>
            <input type="range" className="slider slider-blue" min="-180" max="180" value={az} onChange={(e) => setAz(Number(e.target.value))} style={{ width: '100%', accentColor: '#4c99f2' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#40cc8c', fontSize: '0.9rem', marginBottom: '4px' }}>
              <label>Joint 2 (Shoulder)</label>
              <span>{th2}°</span>
            </div>
            <input type="range" className="slider slider-green" min="-135" max="135" value={th2} onChange={(e) => setTh2(Number(e.target.value))} style={{ width: '100%', accentColor: '#40cc8c' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f2a640', fontSize: '0.9rem', marginBottom: '4px' }}>
              <label>Joint 3 (Elbow)</label>
              <span>{th3}°</span>
            </div>
            <input type="range" className="slider slider-orange" min="-135" max="135" value={th3} onChange={(e) => setTh3(Number(e.target.value))} style={{ width: '100%', accentColor: '#f2a640' }} />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#aaa', margin: '0 0 10px 0' }}>Link Lengths</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', marginBottom: '4px' }}>Ceiling (d1)</label>
              <input type="number" value={d1} onChange={(e) => setD1(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#3c3c4a', color: '#fff', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', marginBottom: '4px' }}>Link 1 (a1)</label>
              <input type="number" value={a1} onChange={(e) => setA1(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#3c3c4a', color: '#fff', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', marginBottom: '4px' }}>Link 2 (a2)</label>
              <input type="number" value={a2} onChange={(e) => setA2(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#3c3c4a', color: '#fff', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', marginBottom: '4px' }}>Tool (a3)</label>
              <input type="number" value={a3} onChange={(e) => setA3(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#3c3c4a', color: '#fff', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        <div style={{ flexGrow: 1 }} />
        <button
          style={{ width: '100%', padding: '10px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 'bold' }}
          onMouseOver={(e) => e.target.style.background = '#555'}
          onMouseOut={(e) => e.target.style.background = '#444'}
          onClick={() => { setAz(0); setTh2(-45); setTh3(60); }}
        >
          Reset Angles
        </button>
      </div>
    </div>
  );
};

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
            <button className="task-button" onClick={() => { }}>1. Tile Replace</button>
            <button className="task-button" onClick={() => { }}>2. Radiation Cleaning</button>
            <button className="task-button" onClick={() => { }}>3. Magnet Removal</button>
            <button className="task-button" onClick={() => { }}>4. Manual Operator Control</button>
          </div>
        </div>
      )}
    </div>
  </div>
);

// 3. The Main App Container
export default function App() {
  const [activeTab, setActiveTab] = useState('camera');
  const [robotMode, setRobotMode] = useState('standby');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionScansLeft, setInspectionScansLeft] = useState(0);

  // App-level WebSocket and Logs state
  const [logs, setLogs] = useState([
    "[System] Initializing network stream...",
    "[System] Waiting for Wi-Fi connection..."
  ]);
  const wsRef = useRef(null);

  useEffect(() => {
    let reconnectTimeout = null;
    let pingInterval = null;

    const connectToWebSocket = () => {
      const ws = new WebSocket("ws://172.30.181.173:82");
      wsRef.current = ws;

      ws.onopen = () => {
        setLogs(prev => {
          const next = [...prev, "[System] WebSocket connected to ESP32."];
          return next.length > 100 ? next.slice(next.length - 100) : next;
        });

        // Actively send a payload every 3s to break half-open invisible drops
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("PING");
          }
        }, 3000);
      };

      ws.onmessage = (event) => {
        let messageEntry = event.data;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.level && parsed.message) {
            messageEntry = `[${parsed.level}] ${parsed.message}`;
          }
        } catch (e) { }

        setLogs((prevLogs) => {
          const nextLogs = [...prevLogs, messageEntry];
          return nextLogs.length > 100 ? nextLogs.slice(nextLogs.length - 100) : nextLogs;
        });
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);

        setLogs(prev => {
          const next = [...prev, "[System] WebSocket disconnected. Attempting to reconnect in 3s..."];
          return next.length > 100 ? next.slice(next.length - 100) : next;
        });
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeout = setTimeout(() => {
          connectToWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        setLogs(prev => {
          const next = [...prev, "[System] WebSocket connection error."];
          return next.length > 100 ? next.slice(next.length - 100) : next;
        });
      };
    };

    connectToWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pingInterval) clearInterval(pingInterval);
      if (wsRef.current) {
        // Remove the close listener so we don't attempt to reconnect on unmount
        wsRef.current.onclose = null; 
        wsRef.current.close();
      }
    };
  }, []);

  const handleSetRobotMode = (mode) => {
    if (isInspecting) return;
    setRobotMode(mode);
    if (mode === 'inspection') {
      setIsInspecting(true);
      setInspectionScansLeft(10); // 10 scans
      setActiveTab('camera');
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("START_INSPECTION");
      }
    }
  };

  useEffect(() => {
    if (isInspecting && inspectionScansLeft <= 0) {
      setIsInspecting(false);
      setRobotMode('standby');
    }
  }, [isInspecting, inspectionScansLeft]);

  // Router function to render the correct component
  const renderContent = () => {
    switch (activeTab) {
      case 'camera': return <CameraPage logs={logs} isInspecting={isInspecting} inspectionScansLeft={inspectionScansLeft} setInspectionScansLeft={setInspectionScansLeft} />;
      case 'home': return <HomePage />;
      case 'dashboard': return <DashboardPage robotMode={robotMode} setRobotMode={handleSetRobotMode} isInspecting={isInspecting} />;
      case 'settings': return <AiTrainingPage />;
      default: return <CameraPage logs={logs} isInspecting={isInspecting} inspectionScansLeft={inspectionScansLeft} setInspectionScansLeft={setInspectionScansLeft} />;
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
            Manually Inspecting ({10 - inspectionScansLeft}/10)
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
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Settings size={18} /> AI Training</span>
        </button>
      </nav>
    </main>
  );
}
