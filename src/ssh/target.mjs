export function parseTarget(target) {
  if (typeof target !== 'string' || !target || /\s/.test(target)) {
    throw new Error('invalid target; expected user@host');
  }
  const at = target.indexOf('@');
  if (at <= 0 || at !== target.lastIndexOf('@') || at === target.length - 1) {
    throw new Error('invalid target; expected user@host');
  }
  const username = target.slice(0, at);
  const host = target.slice(at + 1);
  if (!/^[A-Za-z0-9._-]+$/.test(username) || !/^(?:\[[0-9A-Fa-f]*:[0-9A-Fa-f:]+\]|(?!\[)[A-Za-z0-9._:-]+)$/.test(host)) {
    throw new Error('invalid target; expected user@host');
  }
  return { username, host };
}
