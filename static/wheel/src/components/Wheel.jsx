import { useRef, useState } from "react";
import {
  computeTargetRotation,
  getWedgeAngle,
  pickRandomIndex,
} from "../utils/wheelMath.js";
import { getWedgeColors } from "../utils/colors.js";
import "../styles/Wheel.css";

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 140;
const LABEL_RADIUS = RADIUS - 8;
const HUB_RADIUS = 40;
const HUB_MARGIN = 2;
const AVG_CHAR_WIDTH = 8;
const MAX_LABEL_CHARS = Math.floor(
  (LABEL_RADIUS - HUB_RADIUS - HUB_MARGIN) / AVG_CHAR_WIDTH,
);

// Converts an angle measured clockwise from 12 o'clock into an SVG point on
// the wheel's circumference, matching the rotation convention in wheelMath.
const pointOnCircle = (angleDeg) => {
  const radians = (angleDeg * Math.PI) / 180;
  return [
    CENTER + RADIUS * Math.sin(radians),
    CENTER - RADIUS * Math.cos(radians),
  ];
};

const describeWedge = (startAngle, endAngle) => {
  const [startX, startY] = pointOnCircle(startAngle);
  const [endX, endY] = pointOnCircle(endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
};

// Adapted from hector/single-user-lunch-picker: restaurants are {id, name}
// objects instead of name strings — our restaurant names aren't unique
// (identity is name+phone+address), so wedges key by id and the winner is
// reported as the full object.
const Wheel = ({ restaurants, disabled, onSpinStart, onSpinComplete }) => {
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pendingWinnerRef = useRef(null);

  const count = restaurants.length;
  const wedgeAngle = count > 0 ? getWedgeAngle(count) : 0;
  const wedgeColors = count > 0 ? getWedgeColors(count) : [];

  const handleSpin = () => {
    if (disabled || spinning || count < 2) {
      return;
    }

    const winnerIndex = pickRandomIndex(count);
    pendingWinnerRef.current = restaurants[winnerIndex];

    onSpinStart();
    setSpinning(true);
    setRotationDeg((current) =>
      computeTargetRotation(current, winnerIndex, count),
    );
  };

  const handleTransitionEnd = (event) => {
    if (event.propertyName !== "transform") {
      return;
    }

    setSpinning(false);
    onSpinComplete(pendingWinnerRef.current);
  };

  const hubDisabled = disabled || spinning || count < 2;

  return (
    <div className="wheel">
      <div className="wheel__pointer" aria-hidden="true" />
      <svg
        className="wheel__svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: `rotate(${rotationDeg}deg)` }}
        onTransitionEnd={handleTransitionEnd}
      >
        {count === 0 && (
          <circle cx={CENTER} cy={CENTER} r={RADIUS} className="wheel__empty" />
        )}
        {restaurants.map((restaurant, index) => {
          const startAngle = index * wedgeAngle;
          const endAngle = startAngle + wedgeAngle;
          const midAngle = (startAngle + endAngle) / 2;
          const radians = (midAngle * Math.PI) / 180;
          const tx = CENTER + LABEL_RADIUS * Math.sin(radians);
          const ty = CENTER - LABEL_RADIUS * Math.cos(radians);

          return (
            <g key={restaurant.id}>
              <path
                d={describeWedge(startAngle, endAngle)}
                fill={wedgeColors[index]}
              />
              <text
                x={tx}
                y={ty}
                dy="0.35em"
                className="wheel__label"
                transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
              >
                {restaurant.name.length > MAX_LABEL_CHARS
                  ? `${restaurant.name.slice(0, MAX_LABEL_CHARS - 1)}…`
                  : restaurant.name}
              </text>
            </g>
          );
        })}
      </svg>
      {!spinning && (
        <button
          type="button"
          className="wheel__hub"
          onClick={handleSpin}
          disabled={hubDisabled}
          aria-label="Spin the wheel"
        >
          {count < 2 ? "Add 2+" : "SPIN"}
        </button>
      )}
    </div>
  );
};

export default Wheel;
