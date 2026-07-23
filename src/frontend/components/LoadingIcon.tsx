import { Image } from "@forge/react";
import hamburgerSpin from "../assets/hamburger-spin.gif";

// Animated hamburger icon used at every loading site. Forge caps Custom UI
// to one <Frame> per module (the wheel already uses that slot), and XCSS
// has no transform/keyframes, so the spin is baked into the GIF itself
// rather than driven by CSS or an iframe — see CONTEXT.md §3.15.
const LoadingIcon = () => (
  <Image src={hamburgerSpin} alt="Loading" width={40} height={40} />
);

export default LoadingIcon;
