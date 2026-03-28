import { useEffect, useRef, useState } from 'react';

export default function CameraPage() {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

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
    </div>
  );
}