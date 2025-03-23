const express = require('express');
const router = express.Router();

// Mock device database (in a real app, this would be in a database)
let devices = [
  {
    id: 'nodemcu-001',
    name: 'Living Room Sensor',
    type: 'ESP8266',
    status: 'online',
    ip: '192.168.1.100',
    firmware: '1.0.0',
    lastSeen: new Date().toISOString(),
    config: {
      reportInterval: 30,
      debugMode: false,
      ledEnabled: true
    }
  }
];

// Get all devices
router.get('/', (req, res) => {
  res.status(200).json({
    count: devices.length,
    devices
  });
});

// Get device by ID
router.get('/:id', (req, res) => {
  const device = devices.find(d => d.id === req.params.id);
  
  if (!device) {
    return res.status(404).json({
      message: 'Device not found'
    });
  }
  
  res.status(200).json(device);
});

// Add new device
router.post('/', (req, res) => {
  const {
    id,
    name,
    type = 'ESP8266',
    ip,
    firmware,
    config = {}
  } = req.body;
  
  // Validate required fields
  if (!id || !name) {
    return res.status(400).json({
      message: 'Device ID and name are required'
    });
  }
  
  // Check if device already exists
  if (devices.some(d => d.id === id)) {
    return res.status(409).json({
      message: 'Device with this ID already exists'
    });
  }
  
  // Create new device
  const newDevice = {
    id,
    name,
    type,
    status: 'offline',
    ip,
    firmware,
    lastSeen: new Date().toISOString(),
    config: {
      reportInterval: config.reportInterval || 30,
      debugMode: config.debugMode || false,
      ledEnabled: config.ledEnabled !== undefined ? config.ledEnabled : true
    }
  };
  
  devices.push(newDevice);
  
  res.status(201).json({
    message: 'Device added successfully',
    device: newDevice
  });
});

// Update device
router.put('/:id', (req, res) => {
  const deviceId = req.params.id;
  const deviceIndex = devices.findIndex(d => d.id === deviceId);
  
  if (deviceIndex === -1) {
    return res.status(404).json({
      message: 'Device not found'
    });
  }
  
  const updatedDevice = {
    ...devices[deviceIndex],
    ...req.body,
    // Preserve device ID
    id: deviceId,
    // Merge config objects
    config: {
      ...devices[deviceIndex].config,
      ...(req.body.config || {})
    }
  };
  
  devices[deviceIndex] = updatedDevice;
  
  res.status(200).json({
    message: 'Device updated successfully',
    device: updatedDevice
  });
});

// Delete device
router.delete('/:id', (req, res) => {
  const deviceId = req.params.id;
  const deviceIndex = devices.findIndex(d => d.id === deviceId);
  
  if (deviceIndex === -1) {
    return res.status(404).json({
      message: 'Device not found'
    });
  }
  
  const deletedDevice = devices[deviceIndex];
  devices = devices.filter(d => d.id !== deviceId);
  
  res.status(200).json({
    message: 'Device deleted successfully',
    device: deletedDevice
  });
});

// Send command to device
router.post('/:id/command', (req, res) => {
  const deviceId = req.params.id;
  const { command, params = {} } = req.body;
  
  if (!command) {
    return res.status(400).json({
      message: 'Command is required'
    });
  }
  
  const device = devices.find(d => d.id === deviceId);
  
  if (!device) {
    return res.status(404).json({
      message: 'Device not found'
    });
  }
  
  // In a real application, you would send the command to the device through WebSockets
  // For now, we'll just simulate a response
  
  // Log the command
  console.log(`Command sent to device ${deviceId}: ${command}`, params);
  
  // Simulate command processing
  let response;
  switch (command) {
    case 'restart':
      response = { success: true, message: 'Device restarting' };
      break;
    case 'update':
      response = { success: true, message: 'Firmware update initiated' };
      break;
    case 'config':
      // Update device config
      device.config = {
        ...device.config,
        ...params
      };
      response = { success: true, message: 'Configuration updated', config: device.config };
      break;
    default:
      response = { success: false, message: 'Unknown command' };
  }
  
  res.status(200).json({
    message: 'Command sent to device',
    command,
    params,
    response
  });
});

module.exports = {
  deviceRouter: router
}; 