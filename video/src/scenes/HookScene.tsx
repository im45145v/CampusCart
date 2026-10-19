import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { displayFamily } from "../fonts";
import { Stage, gold, headlineStyle, ivory } from "../Stage";

type HookProps = {
  readonly kicker: string;
  readonly title: string;
  readonly support: string;
  readonly style?: React.CSSProperties;
};

const HookInner: React.FC<HookProps> = ({ kicker, title, support, style }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill
          style={{
            padding: "120px 140px",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: gold,
              opacity: interpolate(frame, [0, 16], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            {kicker}
          </div>
          <div>
            <h1
              style={{
                ...headlineStyle,
                fontSize: 148,
                maxWidth: 1200,
                whiteSpace: "pre-line",
                opacity: interpolate(frame, [0, 16], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
                translate: interpolate(frame, [0, 18], ["0px 28px", "0px 0px"], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              }}
            >
              {title}
            </h1>
            <div
              style={{
                marginTop: 36,
                width: interpolate(frame, [20, 48], [0, 280], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
                height: 3,
                backgroundColor: gold,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: displayFamily,
              fontSize: 44,
              fontWeight: 500,
              maxWidth: 820,
              color: ivory,
              opacity: interpolate(frame, [24, 42], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: interpolate(frame, [24, 46], ["0px 24px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
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

const hookSchema = {
  kicker: {
    type: "text-content",
    default: "Campus marketplace",
    description: "Kicker",
  },
  title: {
    type: "text-content",
    default: "Already\nneeded.",
    description: "Title",
  },
  support: {
    type: "text-content",
    default: "Student stalls. One place to order.",
    description: "Support",
  },
} as const satisfies InteractivitySchema;

export const HookScene = Interactive.withSchema({
  Component: HookInner,
  componentName: "<HookScene>",
  schema: hookSchema,
  wrapInSequence: true,
});
