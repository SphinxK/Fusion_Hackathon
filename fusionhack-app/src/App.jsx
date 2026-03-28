import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import reactLogo from "./assets/react.svg";
import CameraPage from './CameraPage';
import "./App.css";

// 1. We move the Tauri boilerplate into the HomePage so it doesn't clutter the other tabs!
const HomePage = () => {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="container">
      <h1>Welcome to Tauri + React</h1>
      <div className="row">
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank" rel="noreferrer">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </div>
  );
};

// 2. Simple placeholder components
const DashboardPage = () => <div className="placeholder"><h2>Dashboard</h2></div>;
const SettingsPage = () => <div className="placeholder"><h2>Settings</h2></div>;

// 3. The Main App Container
export default function App() {
  const [activeTab, setActiveTab] = useState('camera');

  // Router function to render the correct component
  const renderContent = () => {
    switch (activeTab) {
      case 'camera': return <CameraPage />;
      case 'home': return <HomePage />;
      case 'dashboard': return <DashboardPage />;
      case 'settings': return <SettingsPage />;
      default: return <CameraPage />;
    }
  };

  return (
    <main className="app-container">
      {/* Main Content Area */}
      <div className="content-area">
        {renderContent()}
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="homebar">
        <button 
          className={activeTab === 'camera' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('camera')}
        >
          📷 Camera
        </button>
        <button 
          className={activeTab === 'home' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('home')}
        >
          🏠 Home
        </button>
        <button 
          className={activeTab === 'dashboard' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dash
        </button>
        <button 
          className={activeTab === 'settings' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>
    </main>
  );
}
