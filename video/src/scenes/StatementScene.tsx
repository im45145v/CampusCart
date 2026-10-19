import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { displayFamily, sansFamily } from "../fonts";
import { Stage, gold, ivory } from "../Stage";

type StatementProps = {
  readonly kicker: string;
  readonly title: string;
  readonly support: string;
  readonly style?: React.CSSProperties;
};

export const StatementScene: React.FC<StatementProps> = ({
  kicker,
  title,
  support,
  style,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill
          style={{
            padding: "140px 160px",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              color: gold,
              fontFamily: sansFamily,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {kicker}
          </div>
          <h1
            style={{
              margin: "18px 0 0",
              maxWidth: 1400,
              fontFamily: displayFamily,
              fontWeight: 500,
              fontSize: 92,
              lineHeight: 0.96,
              letterSpacing: -1.5,
              color: ivory,
              whiteSpace: "pre-line",
              opacity: interpolate(frame, [6, 22], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: interpolate(frame, [6, 24], ["0px 28px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            {title}
          </h1>
          <p
            style={{
              marginTop: 28,
              maxWidth: 1100,
              fontFamily: sansFamily,
              fontSize: 36,
              lineHeight: 1.35,
              color: "#E7D3BE",
              opacity: interpolate(frame, [16, 32], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {support}
          </p>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};
