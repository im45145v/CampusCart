import { Composition, Folder } from "remotion";
import { ChatScene } from "./scenes/ChatScene";
import { DiscoverScene } from "./scenes/DiscoverScene";
import { EndScene } from "./scenes/EndScene";
import { HookScene } from "./scenes/HookScene";
import { OrderScene } from "./scenes/OrderScene";
import { SellerScene } from "./scenes/SellerScene";
import { Film } from "./Film";
import { FilmFull } from "./FilmFull";
import { FilmLong } from "./FilmLong";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="UniCart"
        component={Film}
        durationInFrames={2096}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="UniCartLong"
        component={FilmLong}
        durationInFrames={5498}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="UniCartFull"
        component={FilmFull}
        durationInFrames={5542}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition
          id="Hook"
          component={HookScene}
          durationInFrames={114}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            kicker: "Campus marketplace",
            title: "Already\nneeded.",
            support: "Student stalls. One place to order.",
          }}
        />
        <Composition
          id="Discover"
          component={DiscoverScene}
          durationInFrames={136}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Down the hall." }}
        />
        <Composition
          id="Order"
          component={OrderScene}
          durationInFrames={168}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            title: "A few taps.",
            support: "Campus wallet now, or cash when you pick it up.",
          }}
        />
        <Composition
          id="Seller"
          component={SellerScene}
          durationInFrames={115}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            title: "Their price.",
            support: "They write it. The draft never invents the price.",
          }}
        />
        <Composition
          id="Chat"
          component={ChatScene}
          durationInFrames={75}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Hand it over." }}
        />
        <Composition
          id="End"
          component={EndScene}
          durationInFrames={134}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            title: "UniCart",
            support: "Food  ·  Prints  ·  Gear  ·  Chat",
          }}
        />
      </Folder>
    </>
  );
};
