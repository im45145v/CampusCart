import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { Stage, card, clay, forest, gold, headlineStyle, ivory } from "../Stage";

type ChatProps = {
  readonly title: string;
  readonly style?: React.CSSProperties;
};

const ChatInner: React.FC<ChatProps> = ({ title, style }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill style={{ padding: "90px 140px", justifyContent: "center" }}>
          <h1
            style={{
              ...headlineStyle,
              fontSize: 108,
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            {title}
          </h1>
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 22, width: 1400 }}>
            <div
              style={{
                alignSelf: "flex-start",
                backgroundColor: card,
                color: "#2C1810",
                borderRadius: 28,
                borderBottomLeftRadius: 8,
                padding: "26px 34px",
                fontSize: 40,
                fontWeight: 600,
                opacity: interpolate(frame, [6, 16], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                translate: interpolate(frame, [6, 16], ["-24px 0px", "0px 0px"], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              }}
            >
              Ready at the stall.
            </div>
            <div
              style={{
                alignSelf: "flex-end",
                backgroundColor: clay,
                color: ivory,
                borderRadius: 28,
                borderBottomRightRadius: 8,
                padding: "26px 34px",
                fontSize: 40,
                fontWeight: 600,
                opacity: interpolate(frame, [16, 26], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                translate: interpolate(frame, [16, 26], ["24px 0px", "0px 0px"], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              }}
            >
              On my way.
            </div>
          </div>
          <div
            style={{
              marginTop: 42,
              alignSelf: "flex-start",
              backgroundColor: forest,
              color: "#F4FFF8",
              borderRadius: 999,
              padding: "16px 28px",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 1,
              opacity: interpolate(frame, [28, 38], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [28, 40], [0.86, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                output: "perceptual-scale",
              }),
            }}
          >
            Order accepted
          </div>
          <div style={{ position: "absolute", right: 140, bottom: 90, color: gold, fontSize: 26, fontWeight: 600 }}>
            Live chat, then the handoff
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const chatSchema = {
  title: {
    type: "text-content",
    default: "Hand it over.",
    description: "Title",
  },
} as const satisfies InteractivitySchema;

export const ChatScene = Interactive.withSchema({
  Component: ChatInner,
  componentName: "<ChatScene>",
  schema: chatSchema,
  wrapInSequence: true,
});
