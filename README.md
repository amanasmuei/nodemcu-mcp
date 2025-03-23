# NodeMCU MCP (Model Context Protocol) Service

A Model Context Protocol (MCP) service for managing NodeMCU devices. This service provides both a standard RESTful API/WebSocket interface and implements the [Model Context Protocol](https://modelcontextprotocol.io) for integration with AI tools like Claude Desktop.

## Features

- Device registration and management
- Real-time communication via WebSockets
- Configuration management
- Command sending (restart, status, update, etc.)
- Telemetry data collection
- Authentication and authorization
- API endpoints for integration with other services
- **MCP Integration** for use with AI tools like Claude Desktop

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/nodemcu-mcp.git
   cd nodemcu-mcp
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the example:
   ```
   cp .env.example .env
   ```

4. Update the `.env` file with your settings.

5. Install globally (optional):
   ```
   npm install -g .
   ```

## Usage

### As Standard API Server

Development mode with auto-restart:
```
npm run dev
```

Production mode:
```
npm start
```

### As MCP Server

Run in MCP mode for integration with AI tools:
```
npm run mcp
```

If installed globally:
```
nodemcu-mcp --mode=mcp
```

### CLI Options

```
Usage: nodemcu-mcp [options]

Options:
  -m, --mode   Run mode (mcp, api, both)  [string] [default: "both"]
  -p, --port   Port for API server        [number] [default: 3000]
  -h, --help   Show help                  [boolean]
  --version    Show version number        [boolean]
```

## MCP Integration

This tool implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), allowing it to be used as a tool with AI assistants like Claude Desktop.

### Available MCP Tools

- **list-devices**: List all registered NodeMCU devices and their status
- **get-device**: Get detailed information about a specific NodeMCU device
- **send-command**: Send a command to a NodeMCU device
- **update-config**: Update the configuration of a NodeMCU device

### Using with Claude Desktop

To use this tool with Claude Desktop:

1. Install the package globally:
   ```
   npm install -g nodemcu-mcp
   ```

2. Add it to Claude Desktop's MCP tools directory.

3. Claude will now have access to the NodeMCU management tools.

### MCP Protocol Details

This implementation follows the Model Context Protocol version 0.1, using the subprocess execution type. The tool implements the standard MCP JSON message format for communication, including:

- `initialize` message with tool definitions
- `execute_tool` requests from the client
- `tool_response` responses with results

## API Endpoints

### Authentication

- **POST /api/auth/login** - Login with username and password
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```

- **POST /api/auth/validate** - Validate JWT token
  ```json
  {
    "token": "your-jwt-token"
  }
  ```

### Devices

All device endpoints require authentication with a JWT token in the Authorization header:
```
Authorization: Bearer your-jwt-token
```

- **GET /api/devices** - Get all devices
- **GET /api/devices/:id** - Get device by ID
- **POST /api/devices** - Add new device
- **PUT /api/devices/:id** - Update device
- **DELETE /api/devices/:id** - Delete device
- **POST /api/devices/:id/command** - Send command to device

## WebSocket Protocol

The WebSocket server is available at the root path of the server (`ws://your-server:3000/`).

## NodeMCU Client

An example Arduino sketch for NodeMCU devices is provided in the `examples` directory.

## Publishing to Marketplaces

To publish this tool to marketplaces:

1. **NPM Registry**:
   ```
   npm login
   npm publish
   ```

2. **GitHub Marketplace**:
   Create a GitHub Action workflow and publish through GitHub Marketplace.

3. **Claude Plugins Directory**:
   Follow the MCP documentation to submit your tool to Claude's plugin directory.

## Security Considerations

- The example uses a simple in-memory user database with plain text passwords. In a production environment, use a proper database with hashed passwords.
- Generate a strong, random JWT secret for your `.env` file.
- Consider using HTTPS/WSS for secure communication.
- Implement rate limiting to prevent abuse.

## License

MIT 