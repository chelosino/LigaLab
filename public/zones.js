// Derive zone probabilities from each visitor's local simulation distribution.
export function zoneProbability(positions, zone) {
  return positions.slice(zone.from - 1, zone.to).reduce((sum, p) => sum + p, 0);
}
