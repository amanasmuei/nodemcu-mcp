const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { spawn } = require('child_process');
const deviceManager = require('./services/DeviceManager');

// Load environment variables
dotenv.config();

// MCP protocol handlers
class NodeMCUServer {
  constructor() {
    this.toolDefinitions = {
      "list-devices": {
        description: "List all registered NodeMCU devices and their status",
        parameters: {}
      },
      "get-device": {
        description: "Get detailed information about a specific NodeMCU device",
        parameters: {
          deviceId: {
            type: "string",
            description: "The ID of the device to get information about"
          }
        }
      },
      "send-command": {
        description: "Send a command to a NodeMCU device",
        parameters: {
          deviceId: {
            type: "string",
            description: "The ID of the device to send the command to"
          },
          command: {
            type: "string",
            description: "The command to send (restart, update, status, etc.)"
          },
          params: {
            type: "object",
            description: "Optional parameters for the command"
          }
        }
      },
      "update-config": {
        description: "Update the configuration of a NodeMCU device",
        parameters: {
          deviceId: {
            type: "string",
            description: "The ID of the device to update configuration for"
          },
          config: {
            type: "object",
            description: "Configuration parameters to update"
          }
        }
      }
    };
  }

  // Handle MCP initialization
  async initialize() {
    process.stdout.write(JSON.stringify({
      type: "initialize",
      protocol_version: "0.1",
      tools: this.toolDefinitions
    }) + "\n");
  }

  // Process MCP messages from stdin
  async processMessage(message) {
    try {
      const parsed = JSON.parse(message);
      
      switch (parsed.type) {
        case "execute_tool":
          await this.handleToolExecution(parsed);
          break;
        default:
          console.error(`Unknown message type: ${parsed.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      this.sendErrorResponse('internal_error', 'Failed to process message');
    }
  }

  // Handle tool execution requests
  async handleToolExecution(request) {
    const { tool_name, tool_params, request_id } = request;
    
    try {
      let result;
      
      switch (tool_name) {
        case "list-devices":
          result = await this.listDevices();
          break;
        case "get-device":
          result = await this.getDevice(tool_params.deviceId);
          break;
        case "send-command":
          result = await this.sendCommand(tool_params.deviceId, tool_params.command, tool_params.params || {});
          break;
        case "update-config":
          result = await this.updateConfig(tool_params.deviceId, tool_params.config);
          break;
        default:
          throw new Error(`Unknown tool: ${tool_name}`);
      }
      
      this.sendToolResponse(request_id, result);
    } catch (error) {
      console.error(`Error executing tool ${tool_name}:`, error);
      this.sendErrorResponse(request_id, 'tool_execution_error', error.message);
    }
  }

  // Tool implementation: List all devices
  async listDevices() {
    const devices = deviceManager.getAllDevices();
    return {
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        status: device.status,
        lastSeen: device.lastSeen
      })),
      count: devices.length
    };
  }

  // Tool implementation: Get device details
  async getDevice(deviceId) {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }
    
    const device = deviceManager.getDevice(deviceId);
    
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }
    
    return device;
  }

  // Tool implementation: Send command to device
  async sendCommand(deviceId, command, params) {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }
    
    if (!command) {
      throw new Error('Command is required');
    }
    
    try {
      return await deviceManager.sendCommand(deviceId, command, params);
    } catch (error) {
      throw new Error(`Failed to send command: ${error.message}`);
    }
  }

  // Tool implementation: Update device configuration
  async updateConfig(deviceId, config) {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }
    
    if (!config || Object.keys(config).length === 0) {
      throw new Error('Configuration is required');
    }
    
    try {
      return await deviceManager.updateDeviceConfig(deviceId, config);
    } catch (error) {
      throw new Error(`Failed to update configuration: ${error.message}`);
    }
  }

  // Send tool execution response
  sendToolResponse(requestId, result) {
    process.stdout.write(JSON.stringify({
      type: "tool_response",
      request_id: requestId,
      status: "success",
      result
    }) + "\n");
  }

  // Send error response
  sendErrorResponse(requestId, errorType, errorMessage) {
    process.stdout.write(JSON.stringify({
      type: "tool_response",
      request_id: requestId,
      status: "error",
      error: {
        type: errorType,
        message: errorMessage
      }
    }) + "\n");
  }

  // Start the MCP server
  async run() {
    // Initialize and send tool definitions
    await this.initialize();
    
    // Process stdin for MCP messages
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      
      // Process complete JSON messages
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep the last incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          this.processMessage(line);
        }
      }
    });
    
    // Also start the regular API server for compatibility
    this.startAPIServer();
  }
  
  // Start a traditional API server alongside MCP for compatibility
  startAPIServer() {
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    app.use(bodyParser.json());
    
    // Simple endpoint for checking if the server is running
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        message: 'NodeMCU MCP Service is running' 
      });
    });
    
    // Start API server
    app.listen(PORT, () => {
      console.error(`API Server running on port ${PORT}`);
    });
  }
}

// Create and run the MCP server
const server = new NodeMCUServer();
server.run().catch(error => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
}); 