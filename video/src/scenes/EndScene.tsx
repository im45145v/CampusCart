import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { displayFamily, sansFamily } from "../fonts";
import { Stage, gold, ivory } from "../Stage";

type EndProps = {
  readonly title: string;
  readonly support: string;
  readonly style?: React.CSSProperties;
};

const EndInner: React.FC<EndProps> = ({ title, support, style }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: sansFamily,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
              color: gold,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Your campus. Your stalls.
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: displayFamily,
              fontWeight: 500,
              fontSize: 180,
              letterSpacing: -4,
              lineHeight: 0.9,
              color: ivory,
              opacity: interpolate(frame, [8, 24], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              scale: interpolate(frame, [8, 28], [0.96, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                output: "perceptual-scale",
              }),
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 28,
              width: interpolate(frame, [18, 40], [0, 220], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              height: 3,
              backgroundColor: gold,
            }}
          />
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              fontWeight: 500,
              color: "#E7D3BE",
              opacity: interpolate(frame, [28, 44], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {support}
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const endSchema = {
  title: {
    type: "text-content",
    default: "UniCart",
    description: "Title",
  },
  support: {
    type: "text-content",
    default: "Food  ·  Prints  ·  Gear  ·  Chat",
    description: "Support",
  },
} as const satisfies InteractivitySchema;

export const EndScene = Interactive.withSchema({
  Component: EndInner,
  componentName: "<EndScene>",
  schema: endSchema,
  wrapInSequence: true,
});
