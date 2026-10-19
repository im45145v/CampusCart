import { Audio } from "@remotion/media";
import { AbsoluteFill, Series, staticFile, useVideoConfig } from "remotion";
import { ProductScreen } from "./scenes/ProductScreen";
import { StatementScene } from "./scenes/StatementScene";

const SITE = "https://campuscart-web-h46s.onrender.com/";

export const FilmLong: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Audio src={staticFile("voiceover/devi.mp3")} name="Voiceover" volume={1} />
      <Series>
        <Series.Sequence name="Hook" durationInFrames={376} premountFor={fps}>
          <ProductScreen
            shot="screens/live/featured.png"
            kicker="On campus tonight"
            title="Rice. Coffee. A projector."
            caption="Three stalls. One campus."
          />
        </Series.Sequence>
        <Series.Sequence name="The form" durationInFrames={515} premountFor={fps}>
          <StatementScene
            kicker="The order before UniCart"
            title={"A form collects\na name."}
            support="The price, the payment, and what happened next need a real order. When the sheet closes, tomorrow starts from nothing."
          />
        </Series.Sequence>
        <Series.Sequence name="Both of them" durationInFrames={628} premountFor={fps}>
          <ProductScreen
            shot="screens/live/kaaram.png"
            kicker="Student and business"
            title="She runs it. He orders."
            caption="The stall is her business."
          />
        </Series.Sequence>
        <Series.Sequence name="The listing" durationInFrames={724} premountFor={fps}>
          <ProductScreen
            shot="screens/live/coffee.png"
            kicker="Her listing"
            title="Cold coffee, ninety rupees."
            caption="If she didn’t write the price, it doesn’t stay."
          />
        </Series.Sequence>
        <Series.Sequence name="Offers" durationInFrames={600} premountFor={fps}>
          <ProductScreen
            shot="screens/live/offers.png"
            kicker="Her offer"
            title="Ten percent off. Her code."
            caption="The server calculates the discount."
          />
        </Series.Sequence>
        <Series.Sequence name="Payment" durationInFrames={609} premountFor={fps}>
          <ProductScreen
            shot="screens/live/payments.png"
            kicker="UPI"
            title="YouPI signs the payment."
            caption="Campus wallet, or cash at the stall."
          />
        </Series.Sequence>
        <Series.Sequence name="Tracking" durationInFrames={641} premountFor={fps}>
          <ProductScreen
            shot="screens/live/projector.png"
            kicker="Order history"
            title="Placed. Accepted. Ready."
            caption="A loan comes back on the shelf."
          />
        </Series.Sequence>
        <Series.Sequence name="Chat" durationInFrames={629} premountFor={fps}>
          <ProductScreen
            shot="screens/live/brewers.png"
            kicker="Chat and reviews"
            title="The handoff is on the order."
            caption="Message the stall. Under the neem tree."
          />
        </Series.Sequence>
        <Series.Sequence name="Stack" durationInFrames={581} premountFor={fps}>
          <StatementScene
            kicker="Under the counter"
            title={"React. FastAPI.\nMongoDB."}
            support="A live socket carries the chat and the status. Hosted Gemma 4 drafts the words. ElevenLabs only transcribes a recording. She still sets the number."
          />
        </Series.Sequence>
        <Series.Sequence name="Close" durationInFrames={195} premountFor={fps}>
          <ProductScreen
            shot="screens/live/stalls.png"
            kicker="UniCart"
            title="Same order. Both sides."
            caption={SITE}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
