import { useEffect, useState } from "react";
import { events, invoke, view } from "@forge/bridge";
import Wheel from "./components/Wheel.jsx";
import "./styles/app.css";

// invoke() may deliver the value directly or wrapped as { body, metadata } —
// same unwrap the UI Kit host uses.
const unwrap = (value) =>
  value && typeof value === "object" && "body" in value ? value.body : value;

// Thin shell around the Wheel for use inside a UI Kit <Frame>: fetches the
// caller's pool through the app's own resolvers, animates its own entrance
// and exit, and hands the winner back to the host via the Events API.
const WheelApp = () => {
  const [restaurants, setRestaurants] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    invoke("getSavedRestaurants")
      .then((response) => {
        const rows = unwrap(response) ?? [];
        setRestaurants(rows.map(({ id, name }) => ({ id, name })));
      })
      .catch(() => setRestaurants([]));
  }, []);

  useEffect(() => {
    // Custom UI runs in its own iframe/bridge, so it must read the host's
    // theme itself; Frame has no prop to pass it down from the UI Kit host.
    view
      .getContext()
      .then((context) => {
        const colorMode = context?.theme?.colorMode === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-color-mode", colorMode);
      })
      .catch(() => {
        document.documentElement.setAttribute("data-color-mode", "light");
      });
  }, []);

  const handleSpinComplete = (winner) => {
    // Let the winner sit under the pointer for a beat, then fade out and
    // hand the result to the UI Kit host, which closes the Frame.
    setTimeout(() => setLeaving(true), 900);
    setTimeout(() => {
      events.emit("lunch-boss.wheel-result", winner);
    }, 1400);
  };

  if (restaurants === null) {
    return null;
  }

  return (
    <div className={`wheel-app ${leaving ? "wheel-app--leaving" : ""}`}>
      <Wheel
        restaurants={restaurants}
        disabled={leaving}
        onSpinStart={() => {}}
        onSpinComplete={handleSpinComplete}
      />
    </div>
  );
};

export default WheelApp;
