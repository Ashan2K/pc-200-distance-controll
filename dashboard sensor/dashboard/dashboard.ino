/*
    ESP32 - Komatsu PC200-8 Excavator Sensor & GPS Monitoring (WebSocket Sender)
    ----------------------------------------------------
    Combines 28 sensor readings and GPS location data into a single JSON object via WebSocket.
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>    
#include <TinyGPS++.h>      

// === WiFi credentials (CHANGE THESE) ===
const char* ssid = "Redmi Note 14";
const char* password = "A12345678";

// === WebSocket server details (CHANGE THESE) ===
const char* websocket_server_host = "10.161.10.201";
const uint16_t websocket_server_port = 8081;

WebSocketsClient webSocket;

// ------------------- MUX PINS -------------------
const int SIG1 = 32;    // MUX1 output
const int SIG2 = 33;    // MUX2 output
const int S0 = 25, S1 = 26, S2 = 27, S3 = 14;
const int controlPins[4] = { S0, S1, S2, S3 };

// ------------------- DIGITAL INPUTS -------------------
const int radiatorWaterPin = 4;
const int crankPin = 16;
const int camPin = 17;
const int airCleanerPin = 18;
const int waterFuelPin = 19;

// --- JSON Keys for Output (Matching the MUX order) ---
const char* mux1Keys[16] = {
    "eng_oil_lvl", "eng_wtr_temp", "boost_prs", "rail_prs",
    "fuel_lvl", "hyd_oil_temp", "rear_pump_prs", "arm_dump_prs",
    "arm_dig_prs", "bucket_dump_prs", "bucket_dig_prs", "boom_up_prs",
    "boom_down_prs", "swing_left_prs", "swing_right_prs", "front_pump_prs"
};

const char* mux2Keys[8] = {
    "EMPTY", "ac_amb_temp", "sunshine_sen", "amb_air_prs",
    "travel_lf_prs", "travel_lr_prs", "travel_rf_prs", "travel_rr_prs"
};

// ------------------- GPS SETUP -------------------
#define GPS_RX_PIN 15   // New Pin for GPS RX (Connected to GPS TX)
#define GPS_TX_PIN 2    // New Pin for GPS TX (Connected to GPS RX)
#define GPS_BAUD 9600

TinyGPSPlus gps;
HardwareSerial gpsSerial(2); // Use UART 2

// Improved GPS Jitter Filtering
double last_stable_lat = 0.0;
double last_stable_lon = 0.0;
bool initial_fix = false;
unsigned long last_gps_update = 0;
const unsigned long GPS_UPDATE_INTERVAL = 2000; // Update every 2 seconds when stationary

// ------------------- HELPER FUNCTIONS -------------------
void selectChannel(int channel) {
    for (int i = 0; i < 4; i++) {
        digitalWrite(controlPins[i], (channel >> i) & 1);
    }
}

float readMuxVoltage(int sigPin, int channel) {
    selectChannel(channel);
    delayMicroseconds(200);
    int raw = analogRead(sigPin);
    return (raw / 4095.0) * 3.3;
}

// Conversion Functions
float voltageToPressure(float v) {
    return (v < 0.5) ? 0.0 : (v - 0.5) * 10.0;
} 
float voltageToTemperature(float v) {
    return (v < 0.5) ? 0.0 : (v - 0.5) * 37.5;
}
float voltageToLevel(float v) {
    return (v < 0.5) ? 0.0 : (v - 0.5) * 25.0;
}
float voltageToAmbientPressure(float v) {
    if (v < 0.5) return 0.0;
    return (v - 0.5) * (0.1 / 4.0);
}

// === WebSocket Event Handler ===
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("❌ WebSocket Disconnected");
            break;
        case WStype_CONNECTED:
            Serial.print("✅ WebSocket Connected to: ");
            Serial.println((char*)payload);
            break;
        case WStype_TEXT:
            Serial.printf("Server Msg: %s\n", payload);
            break;
    }
}

// ------------------- GPS DATA GATHERING -------------------
void readGpsData() {
    // Process any available GPS serial data without blocking
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }
}

// Improved GPS filtering function
bool getStableGpsData(double &lat, double &lon, float &speed, float &alt, int &sats) {
    if (!gps.location.isValid() || gps.satellites.value() < 4) {
        return false;
    }

    float current_speed_kmph = gps.speed.kmph();
    unsigned long current_time = millis();

    // If we have initial fix and moving slowly, only update periodically
    if (initial_fix && current_speed_kmph < 2.0) {
        if (current_time - last_gps_update < GPS_UPDATE_INTERVAL) {
            // Use last stable position
            lat = last_stable_lat;
            lon = last_stable_lon;
            speed = current_speed_kmph;
            alt = gps.altitude.meters();
            sats = gps.satellites.value();
            return true;
        }
    }

    // Update stable position
    last_stable_lat = gps.location.lat();
    last_stable_lon = gps.location.lng();
    last_gps_update = current_time;
    initial_fix = true;

    lat = last_stable_lat;
    lon = last_stable_lon;
    speed = current_speed_kmph;
    alt = gps.altitude.meters();
    sats = gps.satellites.value();

    return true;
}

// ------------------- SETUP -------------------
void setup() {
    Serial.begin(115200);

    // MUX Control Pins
    for (int i = 0; i < 4; i++) pinMode(controlPins[i], OUTPUT);

    // Digital Input Pins
    pinMode(radiatorWaterPin, INPUT);
    pinMode(crankPin, INPUT);
    pinMode(camPin, INPUT);
    pinMode(airCleanerPin, INPUT);
    pinMode(waterFuelPin, INPUT);

    // Analog Read Attenuation
    analogSetPinAttenuation(SIG1, ADC_11db);
    analogSetPinAttenuation(SIG2, ADC_11db);

    // --- GPS Serial Setup ---
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    Serial.printf("GPS Serial 2 started on RX:%d, TX:%d at 9600 baud\n", GPS_RX_PIN, GPS_TX_PIN);

    // --- WiFi connection ---
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(500);
    }
    Serial.println("\n✅ WiFi Connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

    // --- WebSocket ---
    webSocket.begin(websocket_server_host, websocket_server_port, "/");
    webSocket.onEvent(webSocketEvent);

    Serial.println("=== Komatsu PC200-8 Monitoring & GPS Started ===");
}

// ------------------- MAIN LOOP -------------------
void loop() {
    webSocket.loop();

    if (!webSocket.isConnected()) {
        delay(500);
        return;
    }

    const size_t capacity = 1280; 
    StaticJsonDocument<capacity> doc;

    // -------------------------------------------------------------------------
    // 1. DIGITAL SENSORS (5 total) 
    // -------------------------------------------------------------------------
    doc["rad_wtr_lvl"] = digitalRead(radiatorWaterPin);
    doc["crank_sen"]   = digitalRead(crankPin);
    doc["cam_sen"]     = digitalRead(camPin);
    doc["air_cln_cld"] = digitalRead(airCleanerPin);
    doc["wtr_in_fuel"] = digitalRead(waterFuelPin);

    // -------------------------------------------------------------------------
    // 2. MUX 1 ANALOG SENSORS (16 total)
    // -------------------------------------------------------------------------
    for (int ch = 0; ch < 16; ch++) {
        float voltage = readMuxVoltage(SIG1, ch);
        float value;

        if (ch == 0 || ch == 4) { 
            value = voltageToLevel(voltage);
        }
        else if (ch == 1 || ch == 5) {
            value = voltageToTemperature(voltage);
        }
        else {
            value = voltageToPressure(voltage);
        }
        doc[mux1Keys[ch]] = round(value * 10.0) / 10.0;
    }

    // -------------------------------------------------------------------------
    // 3. MUX 2 ANALOG SENSORS (7 used)
    // -------------------------------------------------------------------------
    for (int ch = 0; ch < 8; ch++) {
        float voltage = readMuxVoltage(SIG2, ch);
        float value;

        if (ch == 1 || ch == 2) {
            value = voltageToTemperature(voltage);
        } else if (ch == 0 || ch == 3) {
            value = voltageToPressure(voltage);
        } else {
            value = voltageToPressure(voltage);
        }

        doc[mux2Keys[ch]] = round(value * 10.0) / 10.0;
    }
    
    // -------------------------------------------------------------------------
    // 4. GPS DATA (with Improved Jitter Filter)
    // -------------------------------------------------------------------------
    readGpsData(); 

    double lat, lon;
    float speed, alt;
    int sats;
    
    if (getStableGpsData(lat, lon, speed, alt, sats)) {
        // Create gps object with consistent structure
        JsonObject gps_data = doc.createNestedObject("gps");
        gps_data["lat"]  = round(lat * 100000.0) / 100000.0;
        gps_data["lon"]  = round(lon * 100000.0) / 100000.0;
        gps_data["speed"]= round(speed * 10.0) / 10.0;
        gps_data["alt"]  = round(alt * 10.0) / 10.0;
        gps_data["sats"] = sats;

        if (gps.date.isValid() && gps.time.isValid()) {
            char time_buf[20];
            snprintf(time_buf, sizeof(time_buf), "%04d-%02d-%02d %02d:%02d:%02d",
                     gps.date.year(), gps.date.month(), gps.date.day(),
                     gps.time.hour(), gps.time.minute(), gps.time.second());
            gps_data["utc"] = time_buf;
        }
    } else {
        // Send empty gps object with status when no fix
        JsonObject gps_data = doc.createNestedObject("gps");
        gps_data["status"] = "NO FIX";
    }

    // -------------------------------------------------------------------------
    // 5. SEND DATA
    // -------------------------------------------------------------------------
    char jsonBuffer[capacity];
    serializeJson(doc, jsonBuffer, capacity);

    webSocket.sendTXT(jsonBuffer);

    Serial.print("TX: ");
    Serial.println(jsonBuffer);

    delay(500); // Refresh rate: 2 times per second
}