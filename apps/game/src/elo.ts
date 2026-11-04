/** Многоигрово Elo по класиране: всеки срещу всеки, K разделено на (n-1). */
export function eloDeltas(players: { uid: string; rating: number; place: number }[], K = 32): Map<string, number> {
  const out = new Map<string, number>();
  const n = players.length;
  if (n < 2) return out;
  for (const a of players) {
    let delta = 0;
    for (const b of players) {
      if (a.uid === b.uid) continue;
      const expected = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
      const score = a.place < b.place ? 1 : a.place === b.place ? 0.5 : 0;
      delta += (K / (n - 1)) * (score - expected);
    }
    out.set(a.uid, Math.round(delta));
  }
  return out;
}
