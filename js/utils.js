export function easeOutCubic(t) {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

export function pickRandomProperty(obj) {
  let result;
  let count = 0;
  for (let prop in obj) {
    if (Math.random() < 1 / ++count) {
      result = prop;
    }
  }
  return result;
}
