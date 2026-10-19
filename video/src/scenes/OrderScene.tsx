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
import { Stage, card, forest, gold, headlineStyle } from "../Stage";

type OrderProps = {
  readonly title: string;
  readonly support: string;
  readonly style?: React.CSSProperties;
};

const rows = [
  { label: "Order", value: "Garlic rice, fried egg" },
  { label: "Slot", value: "Tonight, 7:30" },
  { label: "Hostel", value: "Block C" },
  { label: "Spice", value: "Mild" },
  { label: "Code", value: "RICE20" },
] as const;

const OrderInner: React.FC<OrderProps> = ({ title, support, style }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill
          style={{
            padding: "100px 120px",
            flexDirection: "row",
            gap: 72,
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                color: gold,
                fontWeight: 700,
                letterSpacing: 4,
                fontSize: 24,
                textTransform: "uppercase",
                opacity: interpolate(frame, [0, 14], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Checkout
            </div>
            <h1
              style={{
                ...headlineStyle,
                fontSize: 120,
                marginTop: 18,
                whiteSpace: "pre-line",
                opacity: interpolate(frame, [6, 22], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
                translate: interpolate(frame, [6, 26], ["0px 36px", "0px 0px"], {
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
                fontFamily: displayFamily,
                fontSize: 40,
                lineHeight: 1.25,
                maxWidth: 640,
                color: "#F6F0E6",
                opacity: interpolate(frame, [16, 32], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {support}
            </p>
          </div>
          <div
            style={{
              width: 760,
              backgroundColor: card,
              color: "#2C1810",
              borderRadius: 36,
              padding: "40px 44px 36px",
              boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
              opacity: interpolate(frame, [10, 24], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(frame, [10, 28], ["40px 0px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, color: "#8A6A52" }}>
              KAARAM & KO
            </div>
            {rows.map((row, index) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 24,
                  padding: "18px 0",
                  borderBottom: "1px solid #E7D9C8",
                  fontSize: 30,
                  opacity: interpolate(frame, [18 + index * 6, 30 + index * 6], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                <span style={{ color: "#7A6556" }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
              <div
                style={{
                  flex: 1.4,
                  backgroundColor: forest,
                  color: "#F4FFF8",
                  borderRadius: 18,
                  padding: "18px 20px",
                  fontSize: 26,
                  fontWeight: 700,
                  scale: interpolate(frame, [52, 68], [0.92, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                    output: "perceptual-scale",
                  }),
                }}
              >
                Campus wallet
              </div>
              <div
                style={{
                  flex: 1,
                  border: "2px solid #E7D9C8",
                  borderRadius: 18,
                  padding: "18px 20px",
                  fontSize: 26,
                  fontWeight: 600,
                  color: "#6F4E37",
                }}
              >
                Cash at pickup
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const orderSchema = {
  title: {
    type: "text-content",
    default: "A few taps.",
    description: "Title",
  },
  support: {
    type: "text-content",
    default: "Campus wallet now, or cash when you pick it up.",
    description: "Support",
  },
} as const satisfies InteractivitySchema;

export const OrderScene = Interactive.withSchema({
  Component: OrderInner,
  componentName: "<OrderScene>",
  schema: orderSchema,
  wrapInSequence: true,
});
