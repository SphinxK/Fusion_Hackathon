import { useEffect, useRef } from 'react';
import { Wifi } from 'lucide-react';


export default function CameraPage({ logs }) {
  const logEndRef = useRef(null);

  // Auto-scroll the log window down when new messages arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="camera-container">
      <h2>Live Camera</h2>
      <img
        src="http://10.207.5.199:8080/video"
        alt="Camera Stream"
        className="video-feed"
        onError={(e) => {
          // Fallback to root or /stream if the default Android IP webcam /video path isn't right
          if (e.target.src.includes("/video")) {
            e.target.src = "http://10.207.5.199:8080/";
          } else if (!e.target.src.includes("/stream")) {
            e.target.src = "http://10.207.5.199:8080/stream";
          }
        }}
      />

      {/* Network Log Section */}
      <div className="log-container">
        <div className="log-header">
          <h3><Wifi size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Wi-Fi Logs</h3>
          <span className="log-status pulse">Listening</span>
        </div>
        <div className="log-window">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">{log}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}