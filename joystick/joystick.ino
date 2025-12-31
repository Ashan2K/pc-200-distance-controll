// === ESP32 JCB Arm Control WebSocket Sender ===
// Author: Kolitha, ChatGPT, and Gemini
// Purpose: Reads analog joysticks, filters, maps to a normalized range (-100 to 100),
// and sends the control state as JSON via WebSocket.

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// === WiFi credentials ===
const char* ssid = "Redmi Note 14";
const char* password = "A12345678";

// === WebSocket server details ===
const char* websocket_server_host = "10.161.10.201";
const uint16_t websocket_server_port = 8080;

WebSocketsClient webSocket;

// === ADC Pin Connections (ONLY SAFE PINS) ===
const int RVRx_PIN = 33;  // Bucket
const int RVRy_PIN = 32;  // Boom
const int LVRx_PIN = 34;  // Swing
const int LVRy_PIN = 35;  // Arm

const int SWITCH1_PIN = 26; // Switch 1
const int SWITCH2_PIN = 27; // Switch 2


// === Filtering settings ===
const int FILTER_SIZE = 10;
int rxBuf[FILTER_SIZE], ryBuf[FILTER_SIZE], lxBuf[FILTER_SIZE], lyBuf[FILTER_SIZE];
int fIndex = 0;

// === Joystick center calibration ===
int centerRx = 0, centerRy = 0, centerLx = 0, centerLy = 0;

// === Dead zone ===
const int DEAD_ZONE = 80;

// === Helper Functions ===
int average(int arr[]) {
  long sum = 0;
  for (int i = 0; i < FILTER_SIZE; i++) sum += arr[i];
  return sum / FILTER_SIZE;
}

int applyDeadZone(int value, int center, int threshold) {
  if (abs(value - center) < threshold) return center;
  return value;
}

int mapToNormalized(int value, int center) {
  int deviation = value - center;
  int maxDev = max(center, 4095 - center);
  return constrain((deviation * 100) / maxDev, -100, 100);
}

// === Calibration ===
void calibrateJoystick() {
  Serial.println("Calibrating Joysticks (keep centered)...");
  long rx = 0, ry = 0, lx = 0, ly = 0;

  for (int i = 0; i < 50; i++) {
    rx += analogRead(RVRx_PIN);
    ry += analogRead(RVRy_PIN);
    lx += analogRead(LVRx_PIN);
    ly += analogRead(LVRy_PIN);
    delay(10);
  }

  centerRx = rx / 50;
  centerRy = ry / 50;
  centerLx = lx / 50;
  centerLy = ly / 50;

  Serial.printf("Centers RX:%d RY:%d LX:%d LY:%d\n",
                centerRx, centerRy, centerLx, centerLy);
}

// === WebSocket Event ===
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("✅ WebSocket Connected");
  } else if (type == WStype_DISCONNECTED) {
    Serial.println("❌ WebSocket Disconnected");
  }
}

void setup() {
  Serial.begin(115200);

  // --- ADC settings (CRITICAL) ---
  analogSetAttenuation(ADC_11db);
  analogReadResolution(12);

  pinMode(SWITCH1_PIN, INPUT_PULLUP); // Using internal pull-up resistor
pinMode(SWITCH2_PIN, INPUT_PULLUP);


  // --- WiFi ---
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected");

  // --- WebSocket ---
  webSocket.begin(websocket_server_host, websocket_server_port, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);

  // --- Calibration ---
  calibrateJoystick();

  // --- Initialize filter buffers ---
  for (int i = 0; i < FILTER_SIZE; i++) {
    rxBuf[i] = analogRead(RVRx_PIN);
    ryBuf[i] = analogRead(RVRy_PIN);
    lxBuf[i] = analogRead(LVRx_PIN);
    lyBuf[i] = analogRead(LVRy_PIN);
  }

  Serial.println("=== Joystick Control Ready ===");
}

void loop() {
  webSocket.loop();

  // --- Read & filter ---
  rxBuf[fIndex] = analogRead(RVRx_PIN);
  ryBuf[fIndex] = analogRead(RVRy_PIN);
  lxBuf[fIndex] = analogRead(LVRx_PIN);
  lyBuf[fIndex] = analogRead(LVRy_PIN);
  int switch1State = digitalRead(SWITCH1_PIN) == LOW ? 1 : 0; // 1 = ON, 0 = OFF
int switch2State = digitalRead(SWITCH2_PIN) == LOW ? 1 : 0;


  fIndex = (fIndex + 1) % FILTER_SIZE;

  int Rx = average(rxBuf);
  int Ry = average(ryBuf);
  int Lx = average(lxBuf);
  int Ly = average(lyBuf);

  // --- Dead zone ---
  Rx = applyDeadZone(Rx, centerRx, DEAD_ZONE);
  Ry = applyDeadZone(Ry, centerRy, DEAD_ZONE);
  Lx = applyDeadZone(Lx, centerLx, DEAD_ZONE);
  Ly = applyDeadZone(Ly, centerLy, DEAD_ZONE);

  // --- Map ---
  int bucket = mapToNormalized(Rx, centerRx);
  int boom   = mapToNormalized(Ry, centerRy);
  int swing  = mapToNormalized(Lx, centerLx);
  int arm    = mapToNormalized(Ly, centerLy);

  // --- JSON ---
  StaticJsonDocument<128> doc;
  doc["bucket"] = bucket;
  doc["boom"]   = boom;
  doc["swing"]  = swing;
  doc["arm"]    = arm;
  doc["switch1"] = switch1State;
doc["switch2"] = switch2State;


  char buffer[128];
  serializeJson(doc, buffer);

  if (webSocket.isConnected()) {
    webSocket.sendTXT(buffer);
  }

  Serial.printf("B:%4d BO:%4d S:%4d A:%4d SW1:%d SW2:%d\n",
                bucket, boom, swing, arm, switch1State, switch2State);

  delay(50);
}
