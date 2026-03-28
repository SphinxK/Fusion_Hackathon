import { useEffect, useRef, useState } from 'react';

export default function CameraPage() {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([
    "[System] Camera initialized.",
    "[System] Waiting for Wi-Fi connection..."
  ]);

  useEffect(() => {
    let mediaStream = null;

    async function enableStream() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError("Could not access the camera. Please check permissions.");
        console.error("Camera error:", err);
      }
    }

    enableStream();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="camera-container">
      <h2>Live Camera</h2>
      {error ? (
        <p className="error-text">{error}</p>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="video-feed"
        />
      )}

      {/* Network Log Section */}
      <div className="log-container">
        <div className="log-header">
          <h3>📡 Wi-Fi Logs</h3>
          <span className="log-status pulse">Listening</span>
        </div>
        <div className="log-window">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}