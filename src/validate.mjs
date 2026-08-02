import { readFile } from 'node:fs/promises';

function fail(line, message) {
  throw new Error(`config validation failed at line ${line}: ${message}`);
}

export function validateConfig(text) {
  if (!text.trim()) throw new Error('config validation failed: file is empty');

  let depth = 0;
  let hasStatement = false;
  let line = 1;
  let lineText = '';

  const finishLine = () => {
    let code = '';
    let q = null;
    let e = false;
    for (const char of lineText) {
      if (e) { code += char; e = false; continue; }
      if (q && char === '\\') { code += char; e = true; continue; }
      if (char === '"' || char === "'") {
        q = q === char ? null : q || char;
        code += char;
        continue;
      }
      if (!q && char === '#') break;
      code += char;
    }
    if (q) fail(line, 'unterminated quote');

    const trimmed = code.trim();
    if (!trimmed) return;
    hasStatement = true;

    let open = -1;
    let close = -1;
    q = null; e = false;
    for (let i = 0; i < code.length; i += 1) {
      const char = code[i];
      if (e) { e = false; continue; }
      if (q && char === '\\') { e = true; continue; }
      if (char === '"' || char === "'") { q = q === char ? null : q || char; continue; }
      if (q) continue;
      if (char === '{') { if (open >= 0) fail(line, 'multiple opening braces on one line'); open = i; }
      if (char === '}') { if (close >= 0) fail(line, 'multiple closing braces on one line'); close = i; }
    }

    if (open >= 0 && close >= 0) fail(line, 'opening and closing brace must be on separate lines');
    if (open >= 0) {
      if (!code.slice(0, open).trim() || code.slice(open + 1).trim()) fail(line, 'opening brace must end the line');
      depth += 1;
      return;
    }
    if (close >= 0) {
      if (code.slice(0, close).trim() || code.slice(close + 1).trim()) fail(line, 'closing brace must be alone');
      depth -= 1;
      if (depth < 0) fail(line, 'unexpected closing brace');
    }
  };

  for (const char of text) {
    if (char === '\n') { finishLine(); lineText = ''; line += 1; }
    else lineText += char;
  }
  finishLine();
  if (depth !== 0) fail(line, 'unbalanced braces');
  if (!hasStatement) throw new Error('config validation failed: no configuration statements');
  return text;
}

export async function readAndValidateConfig(path) {
  const text = await readFile(path, 'utf8');
  return validateConfig(text);
}
