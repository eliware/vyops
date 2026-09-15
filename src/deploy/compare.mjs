export function extractCompare(output) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
  const title = new RegExp(`${String.fromCharCode(27)}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(27)}\\\\)`, 'g');
  const clean = output.replace(ansi, '').replace(title, '').replace(new RegExp(`${String.fromCharCode(27)}[=><]`, 'g'), '').replace(/\r/g, '');
  const match = clean.match(/# compare\n([\s\S]*?)(?=\n[^\n]*# printf)/)
    ?? clean.match(/(No changes between working and active configurations\.)[\s\S]*?(?=\n[^\n]*# printf)/);
  return match?.[1].replace(/^\[edit\]\s*$/gm, '').trim() ?? '';
}
