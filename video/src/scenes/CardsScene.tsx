import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { displayFamily, sansFamily } from "../fonts";
import { Stage, card, clay, gold, ivory } from "../Stage";

export type BeatCard = {
  readonly label: string;
  readonly title: string;
  readonly detail: string;
};

type CardsSceneProps = {
  readonly kicker: string;
  readonly title: string;
  readonly cards: readonly BeatCard[];
  readonly caption?: string;
};

export const CardsScene: React.FC<CardsSceneProps> = ({
  kicker,
  title,
  cards,
  caption,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Stage>
        <AbsoluteFill style={{ padding: "88px 96px 120px" }}>
          <div
            style={{
              color: gold,
              fontFamily: sansFamily,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3.5,
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </div>
          <h1
            style={{
              margin: "12px 0 36px",
              maxWidth: 1500,
              fontFamily: displayFamily,
              fontWeight: 500,
              fontSize: 72,
              lineHeight: 0.96,
              letterSpacing: -1.4,
              color: ivory,
              whiteSpace: "pre-line",
            }}
          >
            {title}
          </h1>
          <div style={{ display: "flex", gap: 28 }}>
            {cards.map((item, index) => {
              const delay = 8 + index * 7;
              return (
                <div
                  key={item.title}
                  style={{
                    flex: 1,
                    backgroundColor: card,
                    color: "#140E0A",
                    borderRadius: 28,
                    padding: "36px 34px 40px",
                    minHeight: 340,
                    opacity: interpolate(frame, [delay, delay + 14], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    translate: interpolate(
                      frame,
                      [delay, delay + 16],
                      ["0px 36px", "0px 0px"],
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
                      fontFamily: sansFamily,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: 2.4,
                      textTransform: "uppercase",
                      color: clay,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      marginTop: 18,
                      fontFamily: displayFamily,
                      fontSize: 48,
                      lineHeight: 1,
                      letterSpacing: -1,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      marginTop: 18,
                      fontFamily: sansFamily,
                      fontSize: 26,
                      lineHeight: 1.35,
                      color: "#4A3B32",
                    }}
                  >
                    {item.detail}
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
        {caption ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 42,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(20,14,10,0.88)",
                color: ivory,
                border: "1px solid rgba(198,161,91,0.45)",
                borderRadius: 999,
                padding: "14px 28px",
                fontFamily: sansFamily,
                fontSize: 30,
                fontWeight: 600,
              }}
            >
              {caption}
            </div>
          </div>
        ) : null}
      </Stage>
    </AbsoluteFill>
  );
};
