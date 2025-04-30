#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the main index.js file
const serverPath = join(__dirname, 'index.js');

// Spawn the server process
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

// Handle process exit
server.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle signals to properly terminate the child process
process.on('SIGINT', () => {
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});

