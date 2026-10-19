import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { displayFamily, sansFamily } from "./fonts";

export const ink = "#140E0A";
export const ivory = "#F6F0E6";
export const card = "#FFFBF6";
export const clay = "#C65D3A";
export const gold = "#C6A15B";
export const coffee = "#6F4E37";
export const forest = "#1F6B4A";

export const Stage: React.FC<{
  readonly children: React.ReactNode;
}> = ({ children }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: ink,
        color: ivory,
        fontFamily: sansFamily,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 12% 8%, rgba(198,93,58,0.34), transparent 58%), radial-gradient(ellipse 46% 42% at 92% 88%, rgba(198,161,91,0.2), transparent 52%)",
          scale: interpolate(frame, [0, 150], [1.06, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.16,
          backgroundImage:
            "radial-gradient(rgba(246,240,230,0.55) 0.6px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const headlineStyle = {
  fontFamily: displayFamily,
  fontWeight: 500,
  letterSpacing: -1.5,
  lineHeight: 0.92,
  margin: 0,
} as const;
