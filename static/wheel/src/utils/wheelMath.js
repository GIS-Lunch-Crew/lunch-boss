const MIN_FULL_SPINS = 5;

export const getWedgeAngle = (count) => 360 / count;

export const pickRandomIndex = (count) => Math.floor(Math.random() * count);

// Computes the rotation (in degrees) the wheel must animate to so that the
// chosen wedge ends up under the fixed pointer at the top (0deg/12 o'clock).
// Always returns a value strictly greater than currentRotation so the CSS
// transition has something to animate and the wheel only ever spins forward.
export const computeTargetRotation = (currentRotation, index, count) => {
  const wedgeAngle = getWedgeAngle(count);
  const wedgeCenter = index * wedgeAngle + wedgeAngle / 2;

  // Small jitter within the wedge so the pointer doesn't always land
  // dead-center, bounded so it can never cross into a neighboring wedge.
  const maxJitter = wedgeAngle * 0.3;
  const jitter = (Math.random() * 2 - 1) * maxJitter;

  // The wheel rotates clockwise, so to bring wedgeCenter under the top
  // pointer we need to rotate by -wedgeCenter (mod 360).
  const targetWithinRevolution = (360 - wedgeCenter - jitter + 360) % 360;

  const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
  let delta = targetWithinRevolution - normalizedCurrent;
  if (delta <= 0) {
    delta += 360;
  }

  return currentRotation + 360 * MIN_FULL_SPINS + delta;
};
