#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const jestPath = path.join(__dirname, 'node_modules', '.bin', 'jest');
const testFile = 'src/services/__tests__/leaderboardService.property.test.ts';

const jest = spawn(jestPath, [testFile, '--testTimeout=30000'], {
  cwd: __dirname,
  stdio: 'inherit',
});

jest.on('close', (code) => {
  process.exit(code);
});
