/**
 * NodeMCU MCP Service using the official MCP TypeScript SDK
 * This implementation follows the MCP specification and best practices
 */

// Import required dependencies
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const dotenv = require('dotenv');
const deviceManager = require('./services/DeviceManager');

// Load environment variables
dotenv.config();

// Create the MCP server instance
const server = new McpServer({
  name: "NodeMCU Manager",
  version: "1.0.0"
});

// =========== Tool Implementations ===========

// Tool: List all registered devices
server.tool(
  "list-devices",
  {}, // No parameters required
  async () => {
    try {
      const devices = deviceManager.getAllDevices();
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            devices: devices.map(device => ({
              id: device.id,
              name: device.name,
              status: device.status,
              lastSeen: device.lastSeen
            })),
            count: devices.length
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error listing devices:', error);
      throw new Error(`Failed to list devices: ${error.message}`);
    }
  }
);

// Tool: Get detailed information about a specific device
server.tool(
  "get-device",
  {
    deviceId: z.string().describe("The ID of the device to get information about")
  },
  async ({ deviceId }) => {
    try {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      const device = deviceManager.getDevice(deviceId);
      
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(device, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error getting device:', error);
      throw new Error(`Failed to get device: ${error.message}`);
    }
  }
);

// Tool: Send a command to a device
server.tool(
  "send-command",
  {
    deviceId: z.string().describe("The ID of the device to send the command to"),
    command: z.string().describe("The command to send (restart, update, status, etc.)"),
    params: z.record(z.any()).optional().describe("Optional parameters for the command")
  },
  async ({ deviceId, command, params = {} }) => {
    try {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      if (!command) {
        throw new Error('Command is required');
      }
      
      const result = await deviceManager.sendCommand(deviceId, command, params);
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            success: true,
            deviceId,
            command,
            result
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error sending command:', error);
      throw new Error(`Failed to send command: ${error.message}`);
    }
  }
);

// Tool: Update device configuration
server.tool(
  "update-config",
  {
    deviceId: z.string().describe("The ID of the device to update configuration for"),
    config: z.record(z.any()).describe("Configuration parameters to update")
  },
  async ({ deviceId, config }) => {
    try {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      if (!config || Object.keys(config).length === 0) {
        throw new Error('Configuration is required');
      }
      
      const result = await deviceManager.updateDeviceConfig(deviceId, config);
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            success: true,
            deviceId,
            updatedConfig: result
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error updating config:', error);
      throw new Error(`Failed to update configuration: ${error.message}`);
    }
  }
);

// =========== Server Startup ===========

// Start the MCP server
async function startServer() {
  try {
    console.error("Starting NodeMCU MCP server...");
    
    // Initialize the stdio transport
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    console.error("NodeMCU MCP server connected and ready");
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Start the server
startServer(); 