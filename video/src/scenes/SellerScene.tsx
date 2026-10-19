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
import { Stage, card, clay, gold, headlineStyle } from "../Stage";

type SellerProps = {
  readonly title: string;
  readonly support: string;
  readonly style?: React.CSSProperties;
};

const SellerInner: React.FC<SellerProps> = ({ title, support, style }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill
          style={{
            padding: "100px 120px",
            flexDirection: "row",
            alignItems: "center",
            gap: 64,
          }}
        >
          <div style={{ flex: 1.05 }}>
            <div style={{ color: gold, letterSpacing: 4, fontWeight: 700, fontSize: 24 }}>
              SELLER STUDIO
            </div>
            <h1
              style={{
                ...headlineStyle,
                fontSize: 116,
                marginTop: 16,
                opacity: interpolate(frame, [0, 16], [0, 1], {
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
                marginTop: 24,
                maxWidth: 640,
                fontFamily: displayFamily,
                fontSize: 40,
                lineHeight: 1.25,
                opacity: interpolate(frame, [12, 28], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {support}
            </p>
          </div>
          <div style={{ width: 820, height: 640, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 70,
                width: 420,
                minHeight: 460,
                backgroundColor: "#F3E2C4",
                color: "#3E2A1C",
                borderRadius: 8,
                padding: "36px 32px",
                rotate: "-7deg",
                fontFamily: displayFamily,
                fontSize: 40,
                lineHeight: 1.35,
                boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
                opacity: interpolate(frame, [8, 22], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              garlic rice
              <br />
              fried egg
              <br />
              eighty rupees
              <br />
              mild, if they ask
            </div>
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 30,
                width: 470,
                backgroundColor: card,
                color: "#2C1810",
                borderRadius: 32,
                padding: "32px 32px 28px",
                boxShadow: "0 30px 70px rgba(0,0,0,0.35)",
                opacity: interpolate(frame, [24, 40], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                translate: interpolate(frame, [24, 42], ["30px 20px", "0px 0px"], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#8A6A52" }}>
                DRAFT LISTING
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: displayFamily,
                  fontSize: 48,
                  lineHeight: 1,
                }}
              >
                Garlic rice with a fried egg
              </div>
              <div style={{ marginTop: 16, fontSize: 28, color: "#5C4636" }}>
                Kaaram & Ko · tonight
              </div>
              <div
                style={{
                  marginTop: 28,
                  fontFamily: displayFamily,
                  fontSize: 72,
                  color: clay,
                }}
              >
                ₹80
              </div>
              <div
                style={{
                  marginTop: 12,
                  alignSelf: "flex-start",
                  display: "inline-block",
                  border: `3px solid ${clay}`,
                  color: clay,
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  fontSize: 22,
                  scale: interpolate(frame, [40, 54], [1.3, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.exp),
                    output: "perceptual-scale",
                  }),
                }}
              >
                PRICE STAYS YOURS
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const sellerSchema = {
  title: {
    type: "text-content",
    default: "Their price.",
    description: "Title",
  },
  support: {
    type: "text-content",
    default: "They write it. The draft never invents the price.",
    description: "Support",
  },
} as const satisfies InteractivitySchema;

export const SellerScene = Interactive.withSchema({
  Component: SellerInner,
  componentName: "<SellerScene>",
  schema: sellerSchema,
  wrapInSequence: true,
});
