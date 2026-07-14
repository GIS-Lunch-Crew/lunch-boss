const BASE_HUES = ["#E8A93B", "#D14D33", "#5C8A5F", "#F6D67A"];

const mix = (hex, target, amount) => {
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const from = parseInt(hex.slice(1), 16);
  const to = parseInt(target.slice(1), 16);

  const channel = (shift) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return clamp(Math.round(a + (b - a) * amount));
  };

  const r = channel(16);
  const g = channel(8);
  const b = channel(0);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const tint = (hex) => mix(hex, "#ffffff", 0.25);
const shade = (hex) => mix(hex, "#000000", 0.2);

// Base hues first, then a tint/shade of each for wheels with more wedges
// than the base palette can cover without adjacent repeats.
const PALETTE = [...BASE_HUES, ...BASE_HUES.map(tint), ...BASE_HUES.map(shade)];

// Returns one color per wedge, cycling through the theme palette so that no
// two adjacent wedges share a color — including the wrap-around pair
// (first and last wedge, which sit next to each other on the circle).
export const getWedgeColors = (count) => {
  const colors = Array.from(
    { length: count },
    (_, i) => PALETTE[i % PALETTE.length],
  );

  if (count > 1 && colors[count - 1] === colors[0]) {
    const swapIndex = colors.findIndex(
      (color, i) =>
        i !== 0 &&
        i !== count - 1 &&
        color !== colors[0] &&
        color !== colors[count - 2],
    );
    if (swapIndex !== -1) {
      [colors[count - 1], colors[swapIndex]] = [
        colors[swapIndex],
        colors[count - 1],
      ];
    } else {
      colors[count - 1] = shade(colors[count - 1]);
    }
  }

  return colors;
};
