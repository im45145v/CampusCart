import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { ChatScene } from "./scenes/ChatScene";
import { DiscoverScene } from "./scenes/DiscoverScene";
import { EndScene } from "./scenes/EndScene";
import { HookScene } from "./scenes/HookScene";
import { OrderScene } from "./scenes/OrderScene";
import { SellerScene } from "./scenes/SellerScene";

export const Trailer: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Audio src={staticFile("voiceover/mira.mp3")} name="Voiceover" volume={1} />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Hook" durationInFrames={114} premountFor={fps}>
          <HookScene name="Hook scene" durationInFrames={114} premountFor={fps} kicker="Campus marketplace" title={"Already\nneeded."} support="Student stalls. One place to order." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence name="Discover" durationInFrames={136} premountFor={fps}>
          <DiscoverScene name="Discover scene" durationInFrames={136} premountFor={fps} title="Down the hall." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence name="Order" durationInFrames={168} premountFor={fps}>
          <OrderScene name="Order scene" durationInFrames={168} premountFor={fps} title="A few taps." support="Campus wallet now, or cash when you pick it up." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence name="Seller" durationInFrames={115} premountFor={fps}>
          <SellerScene name="Seller scene" durationInFrames={115} premountFor={fps} title="Their price." support="They write it. The draft never invents the price." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence name="Chat" durationInFrames={75} premountFor={fps}>
          <ChatScene name="Chat scene" durationInFrames={75} premountFor={fps} title="Hand it over." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence name="End" durationInFrames={134} premountFor={fps}>
          <EndScene name="End scene" durationInFrames={134} premountFor={fps} title="UniCart" support="Food  ·  Prints  ·  Gear  ·  Chat" />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
