#!/usr/bin/env node
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { fixConfig, validateConfig } from './src/validate.mjs';

const argv = process.argv.slice(2);
const fix = argv[0] === '--fix';
const [file] = fix ? argv.slice(1) : argv;
if (!file || argv.length !== (fix ? 2 : 1)) {
  console.error('Usage: ./preflight.mjs [--fix] <config.boot>');
  process.exitCode = 1;
} else {
  console.log(`Config preflight: ${file}`);
  try {
    let text = await readFile(file, 'utf8');
    console.log('  ✓ readable');
    if (fix) {
      text = fixConfig(text);
      validateConfig(text);
      const temporary = `${file}.tmp-${process.pid}`;
      try {
        await writeFile(temporary, text, { flag: 'wx' });
        await rename(temporary, file);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      console.log('  ✓ fixed formatting and ordering');
    }
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
