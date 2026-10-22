export function operationTimeout() {
  const value = Number(process.env.VYOPS_OPERATION_TIMEOUT);
  return Number.isFinite(value) && value > 0 ? value : 60000;
}
