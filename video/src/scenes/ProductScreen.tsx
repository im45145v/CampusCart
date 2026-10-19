import type React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { displayFamily, sansFamily } from "../fonts";
import { Stage, gold, ivory } from "../Stage";

type ProductScreenProps = {
  readonly shot: string;
  readonly kicker: string;
  readonly title: string;
  readonly caption: string;
  readonly style?: React.CSSProperties;
};

export const ProductScreen: React.FC<ProductScreenProps> = ({
  shot,
  kicker,
  title,
  caption,
  style,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={style}>
      <Stage>
        <AbsoluteFill
          style={{
            padding: "54px 80px 120px",
            opacity: interpolate(frame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 22,
            }}
          >
            <div>
              <div
                style={{
                  color: gold,
                  fontFamily: sansFamily,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {kicker}
              </div>
              <h1
                style={{
                  margin: "8px 0 0",
                  fontFamily: displayFamily,
                  fontWeight: 500,
                  fontSize: 64,
                  lineHeight: 0.95,
                  letterSpacing: -1,
                  color: ivory,
                }}
              >
                {title}
              </h1>
            </div>
            <div
              style={{
                fontFamily: sansFamily,
                fontSize: 20,
                color: "#E7D3BE",
                fontWeight: 600,
              }}
            >
              https://campuscart-web-h46s.onrender.com/
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 64,
              right: 64,
              top: 210,
              bottom: 120,
              borderRadius: 22,
              overflow: "hidden",
              backgroundColor: "#F6F0E6",
              boxShadow: "0 28px 70px rgba(0,0,0,0.38)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Img
              src={staticFile(shot)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center center",
              }}
            />
          </div>
        </AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            bottom: 36,
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
              fontSize: 32,
              fontWeight: 600,
            }}
          >
            {caption}
          </div>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
