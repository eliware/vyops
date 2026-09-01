import { fs } from '@eliware/common';

function naturalCompare(a, b) {
  if (a.startsWith(b) && a !== b) return 1;
  if (b.startsWith(a) && a !== b) return -1;
  const aa = a.split(/(\d+)/), bb = b.split(/(\d+)/);
  for (let i = 0; i < Math.min(aa.length, bb.length); i += 1) {
    const an = /^\d+$/.test(aa[i]), bn = /^\d+$/.test(bb[i]);
    if (an && bn && Number(aa[i]) !== Number(bb[i])) return Number(aa[i]) - Number(bb[i]);
    if (aa[i] !== bb[i]) return aa[i] < bb[i] ? -1 : 1;
  }
  return aa.length - bb.length || 0;
}

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
    // VyOS values use shell-like quoted strings; escaped characters are retained verbatim.
    if (q) fail(line, 'unterminated quote');

    const trimmed = code.trim();
    if (!trimmed) return;
    hasStatement = true;

    const expectedDepth = trimmed === '}' ? depth - 1 : depth;
    if (expectedDepth < 0) fail(line, 'unexpected closing brace');
    const expectedIndent = '    '.repeat(expectedDepth);
    if (!lineText.startsWith(expectedIndent) || lineText.slice(expectedIndent.length).startsWith(' ')) {
      fail(line, `incorrect indentation; expected ${expectedDepth * 4} spaces`);
    }

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
  const text = await fs.promises.readFile(path, 'utf8');
  return validateConfig(text);
}


export function fixConfig(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim());
  let index = 0;

  const parseLevel = depth => {
    const units = [];
    while (index < lines.length) {
      const trimmed = lines[index++];
      if (!trimmed) { units.push({ key: '', lines: [''] }); continue; }
      if (trimmed.startsWith('#')) units.push({ key: '', lines: [`${'    '.repeat(depth)}${trimmed}`] });
      else if (trimmed === '}') {
        if (depth === 0) throw new Error(`config validation failed: unexpected closing brace at line ${index}`);
        return { units, closed: true };
      } else if (trimmed.endsWith('{')) {
        const header = trimmed;
        const children = parseLevel(depth + 1);
        if (!children.closed) throw new Error(`config validation failed: unbalanced braces at line ${index}`);
        units.push({ key: header, lines: [`${'    '.repeat(depth)}${header}`, ...children.units.flatMap(unit => unit.lines), `${'    '.repeat(depth)}}`] });
      } else units.push({ key: trimmed, lines: [`${'    '.repeat(depth)}${trimmed}`] });
    }

    for (let i = 0; i < units.length;) {
      if (!units[i].key.endsWith('{')) { i += 1; continue; }
      let end = i;
      while (end < units.length && units[end].key.endsWith('{')) end += 1;
      units.splice(i, end - i, ...units.slice(i, end).sort((a, b) => naturalCompare(
        a.key.replace(/\s*\{$/, ''), b.key.replace(/\s*\{$/, ''),
      )));
      i = end;
    }
    return { units, closed: false };
  };

  const parsed = parseLevel(0);
  let output = parsed.units.flatMap(unit => unit.lines);
  const header = [];
  while (output[0]?.startsWith('//')) header.push(output.shift());
  while (output[0] === '') output.shift();
  while (output.at(-1) === '') output.pop();
  if (header.length) output.push('', '', ...header);
  return `${output.join('\n')}\n`;
}
