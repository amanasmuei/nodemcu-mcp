#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";

// MCP Server settings
const char *mcpHost = "your-mcp-server.com";
const int mcpPort = 3000;
const char *mcpPath = "/";

// Device settings
const char *deviceId = "nodemcu-001"; // Unique device ID
const char *deviceName = "Living Room Sensor";
const char *firmwareVersion = "1.0.0";

// Configuration (can be updated from server)
int reportInterval = 30; // seconds
bool debugMode = false;
bool ledEnabled = true;

// WebSocket client
WebSocketsClient webSocket;

// JSON document for messages
StaticJsonDocument<512> jsonDoc;
char jsonBuffer[512];

// Last connection attempt timestamp
unsigned long lastConnectionAttempt = 0;
const int connectionRetryInterval = 5000; // 5 seconds

// Last telemetry timestamp
unsigned long lastTelemetryTime = 0;

void setup()
{
    // Initialize serial
    Serial.begin(115200);
    Serial.println();
    Serial.println("NodeMCU MCP Client Starting...");

    // Initialize LED pin
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, HIGH); // Turn off LED (it's active LOW)

    // Connect to WiFi
    connectToWiFi();

    // Configure WebSocket client
    webSocket.begin(mcpHost, mcpPort, mcpPath);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

void loop()
{
    // Handle WebSocket connection
    webSocket.loop();

    // Check if we're connected
    if (webSocket.isConnected())
    {
        // Send telemetry if it's time
        unsigned long currentTime = millis();
        if (currentTime - lastTelemetryTime > (reportInterval * 1000))
        {
            sendTelemetry();
            lastTelemetryTime = currentTime;
        }
    }
    else
    {
        // Try to reconnect if needed
        unsigned long currentTime = millis();
        if (currentTime - lastConnectionAttempt > connectionRetryInterval)
        {
            Serial.println("Attempting to reconnect WebSocket...");
            webSocket.disconnect();
            webSocket.begin(mcpHost, mcpPort, mcpPath);
            lastConnectionAttempt = currentTime;
        }
    }
}

void connectToWiFi()
{
    Serial.printf("Connecting to %s\n", ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("WiFi connected");
    Serial.printf("IP address: %s\n", WiFi.localIP().toString().c_str());
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
    switch (type)
    {
    case WStype_DISCONNECTED:
        Serial.println("Disconnected from MCP server");
        break;

    case WStype_CONNECTED:
        Serial.println("Connected to MCP server");
        // Register device with server
        registerDevice();
        break;

    case WStype_TEXT:
        handleMessage(payload, length);
        break;

    case WStype_ERROR:
        Serial.println("WebSocket error");
        break;

    default:
        break;
    }
}

void registerDevice()
{
    // Create registration message
    jsonDoc.clear();
    jsonDoc["type"] = "register";
    jsonDoc["deviceId"] = deviceId;
    JsonObject deviceInfo = jsonDoc.createNestedObject("deviceInfo");
    deviceInfo["name"] = deviceName;
    deviceInfo["type"] = "ESP8266";
    deviceInfo["firmware"] = firmwareVersion;
    deviceInfo["ip"] = WiFi.localIP().toString();

    // Send registration message
    serializeJson(jsonDoc, jsonBuffer);
    webSocket.sendTXT(jsonBuffer);

    if (debugMode)
    {
        Serial.println("Registration sent:");
        Serial.println(jsonBuffer);
    }
}

void sendTelemetry()
{
    if (!webSocket.isConnected())
    {
        return;
    }

    // Flash LED if enabled
    if (ledEnabled)
    {
        digitalWrite(LED_BUILTIN, LOW); // Turn on LED (active LOW)
        delay(50);
        digitalWrite(LED_BUILTIN, HIGH); // Turn off LED
    }

    // Create telemetry message
    jsonDoc.clear();
    jsonDoc["type"] = "telemetry";
    jsonDoc["deviceId"] = deviceId;

    JsonObject data = jsonDoc.createNestedObject("data");
    data["uptime"] = millis() / 1000;
    data["heap"] = ESP.getFreeHeap();
    data["rssi"] = WiFi.RSSI();
    data["temperature"] = readTemperature();
    data["humidity"] = readHumidity();

    // Send telemetry message
    serializeJson(jsonDoc, jsonBuffer);
    webSocket.sendTXT(jsonBuffer);

    if (debugMode)
    {
        Serial.println("Telemetry sent:");
        Serial.println(jsonBuffer);
    }
}

void handleMessage(uint8_t *payload, size_t length)
{
    // Convert payload to string
    String message = String((char *)payload);

    if (debugMode)
    {
        Serial.println("Message received:");
        Serial.println(message);
    }

    // Parse JSON message
    DeserializationError error = deserializeJson(jsonDoc, message);
    if (error)
    {
        Serial.print("Failed to parse message: ");
        Serial.println(error.c_str());
        return;
    }

    // Handle message based on type
    const char *type = jsonDoc["type"];

    if (strcmp(type, "config") == 0)
    {
        // Handle configuration update
        JsonObject data = jsonDoc["data"];

        if (data.containsKey("reportInterval"))
        {
            reportInterval = data["reportInterval"];
            Serial.printf("Report interval updated to %d seconds\n", reportInterval);
        }

        if (data.containsKey("debugMode"))
        {
            debugMode = data["debugMode"];
            Serial.printf("Debug mode %s\n", debugMode ? "enabled" : "disabled");
        }

        if (data.containsKey("ledEnabled"))
        {
            ledEnabled = data["ledEnabled"];
            Serial.printf("LED %s\n", ledEnabled ? "enabled" : "disabled");
        }

        // Acknowledge config update
        sendConfigAck();
    }
    else if (strcmp(type, "command") == 0)
    {
        // Handle command
        const char *command = jsonDoc["command"];
        const char *commandId = jsonDoc["commandId"];

        // Process command
        bool success = false;
        String message = "Unknown command";

        if (strcmp(command, "restart") == 0)
        {
            message = "Restarting device";
            success = true;

            // Send response before restarting
            sendCommandResponse(commandId, success, message);

            delay(1000);
            ESP.restart();
            return;
        }
        else if (strcmp(command, "status") == 0)
        {
            message = "Status report generated";
            success = true;
            sendStatusReport(commandId);
            return;
        }

        // Send general response
        sendCommandResponse(commandId, success, message);
    }
    else if (strcmp(type, "registerAck") == 0)
    {
        // Registration acknowledgment
        bool success = jsonDoc["success"];
        if (success)
        {
            Serial.println("Device registered successfully");
        }
        else
        {
            Serial.println("Device registration failed");
        }
    }
}

void sendConfigAck()
{
    jsonDoc.clear();
    jsonDoc["type"] = "configAck";
    jsonDoc["deviceId"] = deviceId;

    JsonObject config = jsonDoc.createNestedObject("config");
    config["reportInterval"] = reportInterval;
    config["debugMode"] = debugMode;
    config["ledEnabled"] = ledEnabled;

    serializeJson(jsonDoc, jsonBuffer);
    webSocket.sendTXT(jsonBuffer);
}

void sendCommandResponse(const char *commandId, bool success, String message)
{
    jsonDoc.clear();
    jsonDoc["type"] = "commandResponse";
    jsonDoc["deviceId"] = deviceId;
    jsonDoc["commandId"] = commandId;

    JsonObject data = jsonDoc.createNestedObject("data");
    data["success"] = success;
    data["message"] = message;

    serializeJson(jsonDoc, jsonBuffer);
    webSocket.sendTXT(jsonBuffer);
}

void sendStatusReport(const char *commandId)
{
    jsonDoc.clear();
    jsonDoc["type"] = "commandResponse";
    jsonDoc["deviceId"] = deviceId;
    jsonDoc["commandId"] = commandId;

    JsonObject data = jsonDoc.createNestedObject("data");
    data["success"] = true;
    data["message"] = "Status report";
    data["uptime"] = millis() / 1000;
    data["freeHeap"] = ESP.getFreeHeap();
    data["chipId"] = ESP.getChipId();
    data["flashSize"] = ESP.getFlashChipSize();
    data["wifiRSSI"] = WiFi.RSSI();
    data["wifiIP"] = WiFi.localIP().toString();
    data["reportInterval"] = reportInterval;
    data["debugMode"] = debugMode;
    data["ledEnabled"] = ledEnabled;

    serializeJson(jsonDoc, jsonBuffer);
    webSocket.sendTXT(jsonBuffer);
}

// Sensor reading functions - Replace with your actual sensor code
float readTemperature()
{
    // Example implementation - replace with actual sensor reading
    return 22.5 + ((float)random(0, 20) / 10.0);
}

float readHumidity()
{
    // Example implementation - replace with actual sensor reading
    return 50.0 + ((float)random(0, 200) / 10.0);
}