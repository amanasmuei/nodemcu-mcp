#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const path = require('path');
const { spawn } = require('child_process');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('mode', {
    alias: 'm',
    description: 'Run mode (mcp, api, both)',
    type: 'string',
    default: 'both'
  })
  .option('port', {
    alias: 'p',
    description: 'Port for API server',
    type: 'number',
    default: 3000
  })
  .help('h')
  .alias('h', 'help')
  .version()
  .argv;

// Set environment variables
process.env.PORT = argv.port;

// Determine which mode to run in
const runMCP = ['mcp', 'both'].includes(argv.mode);
const runAPI = ['api', 'both'].includes(argv.mode);

// Start processes based on mode
if (runMCP) {
  console.log('Starting in MCP mode...');
  
  if (runAPI) {
    // If running both, use MCP SDK server implementation which will only focus on MCP protocol
    const mcpServer = spawn(process.execPath, [path.join(__dirname, '../mcp_server_sdk.js')], {
      stdio: 'inherit'
    });
    
    // Start the API server as a separate process
    const apiServer = spawn(process.execPath, [path.join(__dirname, '../index.js')], {
      stdio: 'inherit',
      env: { ...process.env, PORT: argv.port }
    });
    
    mcpServer.on('close', (code) => {
      console.log(`MCP server exited with code ${code}`);
      apiServer.kill();
      process.exit(code);
    });
    
    apiServer.on('close', (code) => {
      console.log(`API server exited with code ${code}`);
      if (mcpServer.exitCode === null) {
        mcpServer.kill();
        process.exit(code);
      }
    });
  } else {
    // MCP mode only - directly run the MCP server using the SDK implementation
    require('../mcp_server_sdk.js');
  }
} else if (runAPI) {
  // API mode only
  console.log(`Starting API server on port ${argv.port}...`);
  require('../index.js');
} else {
  console.error('Invalid mode. Use --mode=mcp, --mode=api, or --mode=both');
  process.exit(1);
} 