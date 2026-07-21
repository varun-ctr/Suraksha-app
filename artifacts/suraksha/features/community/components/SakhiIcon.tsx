/**
 * Custom Sakhi tab icon — a stylised 6-petal lotus / diya shape.
 * Built with react-native-svg so it renders on both native and web.
 */
import React from "react";
import Svg, { Circle, Ellipse, G } from "react-native-svg";

interface Props {
  color?: string;
  size?: number;
  focused?: boolean;
}

export function SakhiIcon({ color = "#7C3AED", size = 22, focused = false }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  // petal: a narrow vertical ellipse rotated at 0°, 60°, 120°, 180°, 240°, 300°
  const petalRx = size * 0.11;
  const petalRy = size * 0.26;
  const petalOffset = size * 0.14;
  const angles = [0, 60, 120, 180, 240, 300];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {angles.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const ex = cx + petalOffset * Math.sin(rad);
          const ey = cy - petalOffset * Math.cos(rad);
          return (
            <Ellipse
              key={deg}
              cx={ex}
              cy={ey}
              rx={petalRx}
              ry={petalRy}
              fill={focused ? color : color}
              opacity={focused ? 0.85 : 0.7}
              rotation={deg}
              origin={`${ex}, ${ey}`}
            />
          );
        })}
        {/* Centre dot */}
        <Circle cx={cx} cy={cy} r={size * 0.1} fill={color} />
      </G>
    </Svg>
  );
}
