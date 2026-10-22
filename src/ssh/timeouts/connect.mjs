export function connectTimeout(environment = process.env) {
  const configured = Number(environment.VYOPS_CONNECT_TIMEOUT);
  return Number.isFinite(configured) && configured > 0 ? configured : 30000;
}
