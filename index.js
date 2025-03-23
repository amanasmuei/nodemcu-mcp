const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const WebSocket = require('ws');
const http = require('http');
const { deviceRouter } = require('./routes/devices');
const { authRouter } = require('./routes/auth');
const { verifyToken } = require('./middleware/auth');
const deviceManager = require('./services/DeviceManager');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/devices', verifyToken, deviceRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'MCP Service for NodeMCU is running' });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New device connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
      
      // Handle different message types
      switch(data.type) {
        case 'register':
          handleDeviceRegistration(ws, data);
          break;
        case 'status':
          handleStatusUpdate(ws, data);
          break;
        case 'telemetry':
          handleTelemetryData(ws, data);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    // Find device ID associated with this connection
    if (ws.deviceId) {
      console.log(`Device ${ws.deviceId} disconnected`);
      deviceManager.disconnectDevice(ws.deviceId);
    } else {
      console.log('Unknown device disconnected');
    }
  });
  
  // Send initial configuration
  ws.send(JSON.stringify({
    type: 'config',
    data: {
      reportInterval: 30,
      debugMode: false
    }
  }));
});

// Device handlers
function handleDeviceRegistration(ws, data) {
  const deviceId = data.deviceId;
  const deviceInfo = data.deviceInfo || {};
  
  console.log('Device registration:', deviceId, deviceInfo);
  
  // Register the device with the device manager
  const success = deviceManager.registerDevice(deviceId, ws, deviceInfo);
  
  // Store device ID in WebSocket connection
  ws.deviceId = deviceId;
  
  // Send registration acknowledgment
  ws.send(JSON.stringify({
    type: 'registerAck',
    success,
    message: success ? 'Device registered successfully' : 'Device registration failed'
  }));
}

function handleStatusUpdate(ws, data) {
  const deviceId = data.deviceId;
  
  if (!deviceId) {
    console.error('Status update missing device ID');
    return;
  }
  
  console.log('Status update from device:', deviceId, data);
  
  // Update device status (you might want to store this in the device manager)
  if (ws.deviceId === deviceId) {
    const device = deviceManager.getDevice(deviceId);
    if (device) {
      device.status = data.status || 'online';
      device.lastSeen = new Date().toISOString();
      
      // Additional status data if provided
      if (data.data) {
        device.statusData = data.data;
      }
    }
  }
}

function handleTelemetryData(ws, data) {
  const deviceId = data.deviceId;
  
  if (!deviceId) {
    console.error('Telemetry missing device ID');
    return;
  }
  
  console.log('Telemetry from device:', deviceId, data.data);
  
  // Process telemetry data
  if (ws.deviceId === deviceId && data.data) {
    deviceManager.processTelemetry(deviceId, data.data);
  }
}

// Add event listener to device manager
deviceManager.addEventListener((event, data) => {
  console.log(`DeviceManager event: ${event}`, data);
});

// Start server
server.listen(PORT, () => {
  console.log(`MCP Service running on port ${PORT}`);
}); 