#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { validateConfig } from './src/validate.mjs';

const [file] = process.argv.slice(2);
if (process.argv.length !== 3) {
  console.error('Usage: ./preflight.mjs <config.boot>');
  process.exitCode = 1;
} else {
  console.log(`Config preflight: ${file}`);
  try {
    const text = await readFile(file, 'utf8');
    console.log('  ✓ readable');
    if (!text.trim()) throw new Error('config validation failed: file is empty');
    console.log('  ✓ non-empty');
    validateConfig(text);
    console.log('  ✓ quotes balanced');
    console.log('  ✓ braces balanced');
    console.log('  ✓ native VyOS structure');
    console.log('\nPASS');
  } catch (error) {
    console.log(`  ✕ validation: ${error.message}`);
    console.error('\nFAIL');
    process.exitCode = 1;
  }
}
