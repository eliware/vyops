import path from "node:path";

const entries = new Map();
let sequence = 0;

function normalized(value) {
  return path.resolve(String(value));
}

function missing(value) {
  return Object.assign(new Error(`ENOENT: ${value}`), { code: "ENOENT" });
}

function isDirectory(value) {
  return entries.get(normalized(value))?.type === "directory";
}

function ensureParents(value) {
  const parent = path.dirname(normalized(value));
  if (parent === normalized(value) || entries.has(parent)) return;
  ensureParents(parent);
  entries.set(parent, { type: "directory", mode: 0o755, mtimeMs: 1 });
}

async function makeTempDirectory(prefix) {
  const value = `${prefix}${sequence++}`;
  entries.set(normalized(value), { type: "directory", mode: 0o700, mtimeMs: 1 });
  return value;
}

async function makeDirectory(value, options = {}) {
  const name = normalized(value);
  if (entries.has(name)) throw Object.assign(new Error(`EEXIST: ${name}`), { code: "EEXIST" });
  if (options.recursive) ensureParents(name);
  else if (!isDirectory(path.dirname(name))) throw missing(path.dirname(name));
  entries.set(name, { type: "directory", mode: options.mode ?? 0o777, mtimeMs: 1 });
}

async function createFile(value, data, options = {}) {
  const name = normalized(value);
  if (options.flag === "wx" && entries.has(name))
    throw Object.assign(new Error(`EEXIST: ${name}`), { code: "EEXIST" });
  ensureParents(name);
  entries.set(name, {
    type: "file",
    data: Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(String(data)),
    mode: options.mode ?? entries.get(name)?.mode ?? 0o666,
    mtimeMs: 1,
  });
}

async function readFile(value, encoding) {
  const entry = entries.get(normalized(value));
  if (!entry || entry.type !== "file") throw missing(value);
  const data = Buffer.from(entry.data);
  return encoding ? data.toString(encoding) : data;
}

async function listDirectory(value, options = {}) {
  const name = normalized(value);
  if (!isDirectory(name)) {
    if (entries.get(name)?.type === "file")
      throw Object.assign(new Error(`ENOTDIR: ${value}`), { code: "ENOTDIR" });
    throw missing(value);
  }
  const children = new Map();
  for (const [entryPath, entry] of entries) {
    if (path.dirname(entryPath) === name) children.set(path.basename(entryPath), entry.type);
  }
  const names = [...children.keys()].sort();
  if (!options.withFileTypes) return names;
  return names.map((child) => ({
    name: child,
    isDirectory: () => children.get(child) === "directory",
    isFile: () => children.get(child) === "file",
    isSymbolicLink: () => false,
  }));
}

async function removePath(value, options = {}) {
  const name = normalized(value);
  const matches = [...entries.keys()].filter(
    (item) => item === name || item.startsWith(`${name}${path.sep}`),
  );
  if (!matches.length && !options.force) throw missing(value);
  if (matches.length > 1 && !options.recursive)
    throw Object.assign(new Error(`EISDIR: ${value}`), { code: "EISDIR" });
  for (const item of matches) entries.delete(item);
}

async function movePath(from, to) {
  const source = normalized(from);
  const destination = normalized(to);
  const entry = entries.get(source);
  if (!entry) throw missing(from);
  ensureParents(destination);
  const matches = [...entries.entries()].filter(
    ([name]) => name === source || name.startsWith(`${source}${path.sep}`),
  );
  for (const [name] of matches) entries.delete(name);
  for (const [name, value] of matches) {
    const suffix = name.slice(source.length);
    entries.set(`${destination}${suffix}`, value);
  }
  if (!matches.length) entries.set(destination, entry);
}

function metadata(value) {
  const entry = entries.get(normalized(value));
  if (!entry) throw missing(value);
  return {
    mode: entry.mode,
    mtimeMs: entry.mtimeMs,
    isFile: () => entry.type === "file",
    isDirectory: () => entry.type === "directory",
    isSymbolicLink: () => false,
  };
}

async function changeMode(value, mode) {
  const entry = entries.get(normalized(value));
  if (!entry) throw missing(value);
  entry.mode = mode;
}

async function realPath(value) {
  if (!entries.has(normalized(value))) throw missing(value);
  return normalized(value);
}

async function updateTimes(value, _accessed, modified) {
  const entry = entries.get(normalized(value));
  if (!entry) throw missing(value);
  entry.mtimeMs = new Date(modified).getTime();
}

async function access(value) {
  if (!entries.has(normalized(value))) throw missing(value);
}

export const promises = {
  access,
  chmod: changeMode,
  lstat: async (value) => metadata(value),
  mkdir: makeDirectory,
  mkdtemp: makeTempDirectory,
  readFile,
  readdir: listDirectory,
  realpath: realPath,
  rename: movePath,
  rm: removePath,
  stat: async (value) => metadata(value),
  utimes: updateTimes,
  writeFile: createFile,
};

export const filesystem = {
  ...promises,
  promises,
};
filesystem.default = filesystem;

export function resetMemoryFilesystem() {
  entries.clear();
  sequence = 0;
}
