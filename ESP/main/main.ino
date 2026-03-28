#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <SPI.h>
#include <SD.h>
#include <FS.h>
#include <time.h>

// --- CONFIGURATION ---
const char* ssid = "Belal's Galaxy S23 FE";
const char* password = "123456789";

// SD Card Chip Select Pin (Default is usually 5 on generic ESP32)
// Note: If using an ESP32-CAM, you typically use the SD_MMC library instead of standard SD.
#define SD_CS_PIN 5

// Time Configuration (NTP)
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0;       // Replace with your timezone offset in seconds (e.g., -18000 for EST)
const int   daylightOffset_sec = 3600; // Set to 3600 if Daylight Savings applies, 0 if not

// Servers
WebServer server(81);
WebSocketsServer webSocket(82);

unsigned long lastLogTime = 0;

// Dummy 1x1 JPEG for the video stream
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

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// --- MOCK CAMERA STREAM HANDLER ---
void handleStream() {
  WiFiClient client = server.client();
  client.write("HTTP/1.1 200 OK\r\nContent-Type: ");
  client.write(_STREAM_CONTENT_TYPE);
  client.write("\r\n\r\n");

  while (client.connected()) {
    char buffer[64];
    size_t jpg_len = sizeof(dummy_jpg);
    sprintf(buffer, _STREAM_PART, jpg_len);

    client.write(_STREAM_BOUNDARY);
    client.write(buffer);
    client.write(dummy_jpg, jpg_len);
    
    delay(100); 
    webSocket.loop(); 
    sendFakeLogs();
  }
}

// --- FAKE LOG GENERATOR & SD WRITER ---
void sendFakeLogs() {
  if (millis() - lastLogTime > 5000) {
    // 1. Get the current time
    struct tm timeinfo;
    char timeStringBuff[50];
    
    if(!getLocalTime(&timeinfo)){
      strcpy(timeStringBuff, "Time Not Synced");
    } else {
      // Format: YYYY-MM-DD HH:MM:SS
      strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
    }

    // 2. Create the JSON log
    //String mockLog = "{\"timestamp\":\"" + String(timeStringBuff) + "\", \"level\":\"INFO\", \"message\":\"System nominal. Temp: " + String(random(20, 30)) + "C\"}";
    String mockLog = "Standby...";
    
    // 3. Send to App via WebSocket
    webSocket.broadcastTXT(mockLog);
    Serial.println("Sent & Saved Log: " + mockLog);
    
    // 4. Save to SD Card
    appendLogToSD(timeStringBuff, mockLog);
    
    lastLogTime = millis();
  }
}

// --- SD CARD HELPER ---
void appendLogToSD(const char* timeStamp, String logData) {
  // Open file in append mode. It creates the file if it doesn't exist.
  File file = SD.open("/logs.txt", FILE_APPEND);
  
  if(!file){
    Serial.println("Failed to open file for appending");
    return;
  }
  
  // Write the data
  file.print("[");
  file.print(timeStamp);
  file.print("] ");
  file.println(logData);
  
  file.close();
}

// --- WEBSOCKET EVENT HANDLER (Receiving Commands) ---
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] App Disconnected\n", num);
      break;
      
    case WStype_CONNECTED:
      Serial.printf("[%u] App Connected!\n", num);
      break;
      
    case WStype_TEXT:
      // We received a text message from the app!
      // Convert the raw payload bytes into a standard String
      String command = String((char*)payload);
      Serial.printf("[%u] Received command from app: %s\n", num, command.c_str());

      // --- COMMAND LOGIC ---
      if (command == "TURN_ON_LIGHT") {
        Serial.println("Action: Turning on the LED!");
        // digitalWrite(LED_PIN, HIGH);
      } 
      else if (command == "TURN_OFF_LIGHT") {
        Serial.println("Action: Turning off the LED!");
        // digitalWrite(LED_PIN, LOW);
      }
      else if (command == "RESET_LOGS") {
        Serial.println("Action: App requested to clear logs.");
        // Add logic to wipe the SD card file here
      }
      else {
        Serial.println("Unknown command received.");
      }
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // 1. Initialize SD Card FIRST
  Serial.println("\nInitializing SD card...");

  pinMode(19, INPUT_PULLUP);

  // Force the SPI bus to initialize on the exact pins, then slow it down to 4MHz
  SPI.begin(18, 19, 23, SD_CS_PIN); 
  if(!SD.begin(SD_CS_PIN, SPI, 4000000)){
    Serial.println("Card Mount Failed! Check wiring.");
  } else {
    Serial.println("SD Card initialized successfully.");
  }

  // 2. Connect to Wi-Fi
  Serial.println("Connecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi connected! IP: " + WiFi.localIP().toString());

  // 3. Sync Time via NTP
  Serial.println("Syncing time with NTP server...");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.println("Time successfully synced!");
  } else {
    Serial.println("Time sync failed.");
  }

  // 4. Start Servers
  webSocket.begin();
  server.on("/stream", handleStream);
  server.begin();
}

void loop() {
  server.handleClient();
  webSocket.loop();
  sendFakeLogs();
}