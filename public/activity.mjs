const clamp=n=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
// A visual envelope, not an inference about thought. Silence and speech are smooth.
export function advanceActivity(current, rms, speaking, dt) {
  const target=speaking ? .38+.62*clamp(rms*8) : .08;
  const seconds=Math.min(.2,Math.max(0,Number.isFinite(dt)?dt:0));
  return clamp(current)+(target-clamp(current))*(1-Math.exp(-seconds*(speaking?5:3)));
}
