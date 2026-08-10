#!/usr/bin/env node

if (process.argv.includes('--debug')) process.env.LOG_LEVEL = 'debug';
await import('./src/main.mjs');
