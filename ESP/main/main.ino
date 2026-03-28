#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>

// --- CONFIGURATION ---
const char* ssid = "Belal's Galaxy S23 FE";
const char* password = "123456789";

// Port 81 for the HTTP Video Stream, Port 82 for WebSocket Logs
WebServer server(81);
WebSocketsServer webSocket(82);

// Timer for our fake logs
unsigned long lastLogTime = 0;

// A tiny, mathematically valid 1x1 pixel black JPEG. 
// This prevents your app's image renderer from crashing on bad data.
const uint8_t dummy_jpg[] = {
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03,
  0x03, 0x03, 0x03, 0x04, 0x03, 0x03, 0x04, 0x05, 0x08, 0x05, 0x05, 0x04, 0x04, 0x05, 0x0A, 0x07,
  0x07, 0x06, 0x08, 0x0C, 0x0A, 0x0C, 0x0C, 0x0B, 0x0A, 0x0B, 0x0B, 0x0D, 0x0E, 0x12, 0x10, 0x0D,
  0x0E, 0x11, 0x0E, 0x0B, 0x0B, 0x10, 0x16, 0x10, 0x11, 0x13, 0x14, 0x15, 0x15, 0x15, 0x0C, 0x0F,
  0x17, 0x18, 0x16, 0x14, 0x18, 0x12, 0x14, 0x15, 0x14, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14,
  0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x3F, 0x00, 0xFF, 0xD9
};

// Standard MJPEG HTTP Header boundaries
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// --- MOCK CAMERA STREAM HANDLER ---
void handleStream() {
  WiFiClient client = server.client();
  
  // Send the initial HTTP response letting the app know a stream is coming
  client.write("HTTP/1.1 200 OK\r\n");
  client.write("Content-Type: ");
  client.write(_STREAM_CONTENT_TYPE);
  client.write("\r\n\r\n");

  // Keep pumping out the same dummy image as long as the app is connected
  while (client.connected()) {
    char buffer[64];
    size_t jpg_len = sizeof(dummy_jpg);
    sprintf(buffer, _STREAM_PART, jpg_len);

    client.write(_STREAM_BOUNDARY);
    client.write(buffer);
    client.write(dummy_jpg, jpg_len);
    
    // Simulate a ~10 fps frame rate (100ms delay)
    delay(100); 
    
    // CRUCIAL: Keep websockets alive while the stream loop is blocking!
    webSocket.loop(); 
    sendFakeLogs();
  }
}

// --- FAKE LOG GENERATOR ---
void sendFakeLogs() {
  // Only send a log every 2 seconds
  if (millis() - lastLogTime > 2000) {
    String mockLog = "{\"timestamp\":" + String(millis()) + ", \"level\":\"INFO\", \"message\":\"System nominal. Temp: " + String(random(20, 30)) + "C\"}";
    
    // Broadcast to any app connected to the websocket
    webSocket.broadcastTXT(mockLog);
    Serial.println("Sent log: " + mockLog);
    
    lastLogTime = millis();
  }
}

// Optional: WebSocket event handler for debugging connections
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("[%u] App Connected to Logs!\n", num);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // 1. Connect to Wi-Fi
  Serial.println("\nConnecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // 2. Start WebSocket Server (Logs)
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.println("WebSocket Server started on port 82 (ws://" + WiFi.localIP().toString() + ":82)");

  // 3. Start HTTP Server (Video)
  server.on("/stream", handleStream);
  server.begin();
  Serial.println("Video Server started on port 81 (http://" + WiFi.localIP().toString() + ":81/stream)");
}

void loop() {
  // Listen for incoming HTTP video requests
  server.handleClient();
  
  // Listen for incoming WebSocket connections
  webSocket.loop();
  
  // Generate logs
  sendFakeLogs();
}