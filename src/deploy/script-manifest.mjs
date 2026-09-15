const safePath = name => /^[A-Za-z0-9._/-]+$/.test(name) && !name.startsWith('/') && !name.split('/').includes('..');

export async function readManagedPaths(readFile, manifestPath) {
  try {
    const names = (await readFile(manifestPath, 'utf8'))
      .split(/\r?\n/)
      .filter(line => line.startsWith('file\t'))
      .map(line => line.split('\t')[1])
      .filter(Boolean);
    if (names.some(name => !safePath(name))) throw new Error('deployment manifest contains an unsafe script path');
    return new Set(names);
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}

export function unmanagedPaths(liveOutput, managed) {
  return liveOutput.split('\0').filter(Boolean)
    .map(file => file.replace(/^\/config\/scripts\/?/, ''))
    .filter(file => file && !managed.has(file));
}
