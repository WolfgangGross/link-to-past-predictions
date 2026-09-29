/**
 * Draws a value from a predictive distribution given as quantiles (piecewise-linear inverse CDF).
 * Beyond the outermost quantiles the tails continue with the outermost slope, doubled on the right:
 * travel times, like most things that go wrong, have fat right tails.
 */
export function sampleFromQuantiles(q: Record<number, number>, u = Math.random()): number {
  const levels = Object.keys(q).map(Number).sort((a, b) => a - b);
  const slope = (i: number, j: number) => (q[levels[j]] - q[levels[i]]) / (levels[j] - levels[i]);
  if (u <= levels[0]) return q[levels[0]] - (levels[0] - u) * slope(0, 1);
  for (let i = 1; i < levels.length; i++) {
    const [a, b] = [levels[i - 1], levels[i]];
    if (u <= b) return q[a] + ((q[b] - q[a]) * (u - a)) / (b - a);
  }
  const n = levels.length - 1;
  return q[levels[n]] + (u - levels[n]) * slope(n - 1, n) * 2;
}
