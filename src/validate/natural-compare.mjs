export function naturalCompare(a, b) {
  if (a.startsWith(b) && a !== b) return 1;
  if (b.startsWith(a) && a !== b) return -1;
  const aa = a.split(/(\d+)/);
  const bb = b.split(/(\d+)/);
  for (let index = 0; index < Math.min(aa.length, bb.length); index += 1) {
    const an = /^\d+$/.test(aa[index]);
    const bn = /^\d+$/.test(bb[index]);
    if (an && bn && Number(aa[index]) !== Number(bb[index]))
      return Number(aa[index]) - Number(bb[index]);
    if (aa[index] !== bb[index]) return aa[index] < bb[index] ? -1 : 1;
  }
  return aa.length - bb.length || 0;
}
