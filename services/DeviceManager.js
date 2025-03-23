/**
 * DeviceManager service for handling NodeMCU device connections and state
 */
class DeviceManager {
  constructor() {
    this.devices = new Map(); // deviceId -> device object
    this.connections = new Map(); // deviceId -> websocket connection
    this.listeners = new Set(); // Event listeners
  }

  /**
   * Register a new device connection
   * @param {string} deviceId - Device identifier
   * @param {object} ws - WebSocket connection
   * @param {object} deviceInfo - Device information
   * @returns {boolean} - Success status
   */
  registerDevice(deviceId, ws, deviceInfo = {}) {
    if (!deviceId || !ws) {
      return false;
    }

    // Store connection
    this.connections.set(deviceId, ws);

    // Update device info
    const device = this.devices.get(deviceId) || {};
    const updatedDevice = {
      ...device,
      ...deviceInfo,
      id: deviceId,
      status: 'online',
      lastSeen: new Date().toISOString()
    };

    this.devices.set(deviceId, updatedDevice);
    
    // Notify listeners
    this._notifyListeners('deviceConnected', updatedDevice);
    
    return true;
  }

  /**
   * Update device status to offline
   * @param {string} deviceId - Device identifier
   */
  disconnectDevice(deviceId) {
    if (!deviceId || !this.devices.has(deviceId)) {
      return false;
    }

    // Remove connection
    this.connections.delete(deviceId);

    // Update device status
    const device = this.devices.get(deviceId);
    const updatedDevice = {
      ...device,
      status: 'offline',
      lastSeen: new Date().toISOString()
    };

    this.devices.set(deviceId, updatedDevice);
    
    // Notify listeners
    this._notifyListeners('deviceDisconnected', updatedDevice);
    
    return true;
  }

  /**
   * Get all registered devices
   * @returns {Array} - Array of device objects
   */
  getAllDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by ID
   * @param {string} deviceId - Device identifier
   * @returns {object|null} - Device object or null if not found
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Send command to device
   * @param {string} deviceId - Device identifier
   * @param {string} command - Command name
   * @param {object} params - Command parameters
   * @returns {Promise} - Promise resolving to command result
   */
  async sendCommand(deviceId, command, params = {}) {
    const ws = this.connections.get(deviceId);
    
    if (!ws || ws.readyState !== 1) { // WebSocket.OPEN = 1
      throw new Error('Device not connected');
    }

    return new Promise((resolve, reject) => {
      try {
        // Generate unique command ID
        const commandId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        // Create message
        const message = {
          type: 'command',
          commandId,
          command,
          params
        };

        // Set up one-time response handler
        const responseHandler = (event) => {
          try {
            const response = JSON.parse(event.data);
            
            if (response.type === 'commandResponse' && response.commandId === commandId) {
              ws.removeEventListener('message', responseHandler);
              resolve(response.data);
            }
          } catch (error) {
            // Ignore non-JSON messages
          }
        };

        // Set timeout for command
        const timeout = setTimeout(() => {
          ws.removeEventListener('message', responseHandler);
          reject(new Error('Command timed out'));
        }, 5000);

        // Add response handler
        ws.addEventListener('message', responseHandler);
        
        // Send command
        ws.send(JSON.stringify(message));
        
        // Notify listeners
        this._notifyListeners('commandSent', {
          deviceId,
          command,
          params,
          commandId
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update device configuration
   * @param {string} deviceId - Device identifier
   * @param {object} config - Configuration values
   * @returns {Promise} - Promise resolving to updated config
   */
  async updateDeviceConfig(deviceId, config = {}) {
    try {
      const result = await this.sendCommand(deviceId, 'config', config);
      
      // Update stored device config
      if (this.devices.has(deviceId)) {
        const device = this.devices.get(deviceId);
        device.config = {
          ...device.config,
          ...config
        };
        this.devices.set(deviceId, device);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process telemetry data from device
   * @param {string} deviceId - Device identifier
   * @param {object} data - Telemetry data
   */
  processTelemetry(deviceId, data) {
    if (!deviceId || !this.devices.has(deviceId)) {
      return false;
    }

    // Update last seen timestamp
    const device = this.devices.get(deviceId);
    device.lastSeen = new Date().toISOString();
    
    // Store telemetry (in a real app, you'd store this in a database)
    device.lastTelemetry = data;
    
    this.devices.set(deviceId, device);
    
    // Notify listeners
    this._notifyListeners('telemetryReceived', {
      deviceId,
      data,
      timestamp: device.lastSeen
    });
    
    return true;
  }

  /**
   * Add event listener
   * @param {function} callback - Callback function
   */
  addEventListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  }

  /**
   * Remove event listener
   * @param {function} callback - Callback function
   */
  removeEventListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of an event
   * @private
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  _notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in device manager event listener:', error);
      }
    });
  }
}

// Create singleton instance
const deviceManager = new DeviceManager();

module.exports = deviceManager; 