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
import { Stage, card, clay, coffee, gold, headlineStyle } from "../Stage";

type DiscoverProps = {
  readonly title: string;
  readonly style?: React.CSSProperties;
};

const stalls = [
  { name: "Kaaram & Ko", item: "Garlic rice, fried egg", meta: "Food", price: "₹80" },
  { name: "Tanuj Prints", item: "One-page document", meta: "Prints", price: "Upfront" },
  { name: "Potato's", item: "Projector for the night", meta: "Gear", price: "Daily" },
] as const;

const StallCard: React.FC<{
  readonly stall: (typeof stalls)[number];
  readonly delay: number;
}> = ({ stall, delay }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: card,
        color: "#2C1810",
        borderRadius: 32,
        padding: "36px 34px 32px",
        display: "flex",
        flexDirection: "column",
        minHeight: 520,
        boxShadow: "0 28px 70px rgba(0,0,0,0.32)",
        opacity: interpolate(frame, [delay, delay + 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: interpolate(
          frame,
          [delay, delay + 22],
          ["0px 70px", "0px 0px"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
      }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          backgroundColor: "#F3E6D4",
          color: coffee,
          borderRadius: 999,
          padding: "8px 16px",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        {stall.meta}
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily: displayFamily,
          fontSize: 48,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: -0.8,
        }}
      >
        {stall.name}
      </div>
      <div style={{ marginTop: 18, fontSize: 30, lineHeight: 1.25, color: "#5C4636" }}>
        {stall.item}
      </div>
      <div style={{ marginTop: "auto", fontFamily: displayFamily, fontSize: 64, color: clay }}>
        {stall.price}
      </div>
    </div>
  );
};

const DiscoverInner: React.FC<DiscoverProps> = ({ title, style }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill style={{ padding: "88px 110px 80px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 36,
            }}
          >
            <h1
              style={{
                ...headlineStyle,
                fontSize: 96,
                opacity: interpolate(frame, [0, 16], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              }}
            >
              {title}
            </h1>
            <div style={{ fontSize: 28, color: gold, fontWeight: 600, letterSpacing: 1 }}>
              From the stall beside you
            </div>
          </div>
          <div style={{ display: "flex", gap: 28, flex: 1 }}>
            <StallCard stall={stalls[0]} delay={8} />
            <StallCard stall={stalls[1]} delay={16} />
            <StallCard stall={stalls[2]} delay={24} />
          </div>
          <div style={{ height: 8 }} />
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const discoverSchema = {
  title: {
    type: "text-content",
    default: "Down the hall.",
    description: "Title",
  },
} as const satisfies InteractivitySchema;

export const DiscoverScene = Interactive.withSchema({
  Component: DiscoverInner,
  componentName: "<DiscoverScene>",
  schema: discoverSchema,
  wrapInSequence: true,
});
