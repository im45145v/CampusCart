import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  interpolate,
  Series,
  staticFile,
  useVideoConfig,
} from "remotion";
import { CardsScene } from "./scenes/CardsScene";
import { ProductScreen } from "./scenes/ProductScreen";
import { StatementScene } from "./scenes/StatementScene";

const SITE = "https://campuscart-web-h46s.onrender.com/";

export const FilmFull: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Audio src={staticFile("voiceover/prahlad-full.mp3")} name="Voiceover" volume={1} />
      <Audio
        src={staticFile("music/bed-full.mp3")}
        name="Music"
        volume={(frame) =>
          interpolate(frame, [0, 24, durationInFrames - 36, durationInFrames], [0, 0.14, 0.14, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Series>
        <Series.Sequence name="Hook" durationInFrames={517} premountFor={fps}>
          <CardsScene
            kicker="On campus tonight"
            title="Three businesses."
            cards={[
              { label: "Food", title: "Rice stall", detail: "It doesn’t look like a business." },
              { label: "Coffee", title: "Coffee cart", detail: "Under the neem tree." },
              { label: "Lending", title: "A projector", detail: "Lent for the night." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Form" durationInFrames={503} premountFor={fps}>
          <StatementScene
            kicker="Before UniCart"
            title={"A form collects\na name."}
            support="The price, the payment, and what happened next need a real order. When the sheet closes, tomorrow starts from nothing."
          />
        </Series.Sequence>
        <Series.Sequence name="Both" durationInFrames={743} premountFor={fps}>
          <CardsScene
            kicker="Student and business"
            title={"She runs it.\nHe orders."}
            cards={[
              { label: "Seller", title: "Her stall", detail: "What she cooks, pours, or lends." },
              { label: "Buyer", title: "His counter", detail: "A student, standing there." },
              { label: "UniCart", title: "Both of them", detail: "The order belongs to each." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Listing" durationInFrames={745} premountFor={fps}>
          <ProductScreen
            shot="screens/live/featured.png"
            kicker="Her listing"
            title="If she didn’t write the price, it doesn’t stay."
            caption="Cold coffee, ninety rupees. A projector, one hundred and twenty a day."
          />
        </Series.Sequence>
        <Series.Sequence name="Offers" durationInFrames={445} premountFor={fps}>
          <CardsScene
            kicker="Her offer"
            title="The server does the math."
            cards={[
              { label: "New account", title: "10% off", detail: "Campus Brewers." },
              { label: "Her code", title: "₹20 off", detail: "The rice, once he enters it." },
              { label: "Checkout", title: "Calculated", detail: "He never sends the discount." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Pay" durationInFrames={591} premountFor={fps}>
          <CardsScene
            kicker="Payment"
            title="YouPI signs it."
            cards={[
              { label: "Wallet", title: "Campus credits", detail: "Or cash, when her stall takes it." },
              { label: "UPI", title: "Signed", detail: "The credit lands with the signature." },
              { label: "Ledger", title: "In paise", detail: "Both of them can see what was paid." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Trail" durationInFrames={619} premountFor={fps}>
          <CardsScene
            kicker="The order stays open"
            title="Placed. Accepted. Ready."
            cards={[
              { label: "Status", title: "Being made", detail: "A notification when it moves." },
              { label: "Lending", title: "Collected", detail: "Then back on the shelf." },
              { label: "History", title: "Both trails", detail: "His order history, and hers." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Chat" durationInFrames={617} premountFor={fps}>
          <CardsScene
            kicker="Same order"
            title="The handoff."
            cards={[
              { label: "Chat", title: "Neem tree", detail: "Bring the HDMI lead." },
              { label: "Review", title: "After", detail: "He leaves one. She can answer." },
              { label: "Next", title: "They read it", detail: "Before they order." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Stack" durationInFrames={589} premountFor={fps}>
          <StatementScene
            kicker="Under the counter"
            title={"React. FastAPI.\nMongoDB."}
            support="A live socket carries the chat and the status. Hosted Gemma 4 drafts the words. ElevenLabs only transcribes a recording. She still sets the number."
          />
        </Series.Sequence>
        <Series.Sequence name="Close" durationInFrames={173} premountFor={fps}>
          <StatementScene
            kicker="Food  ·  Coffee  ·  Something you bring back"
            title="That’s UniCart."
            support={SITE}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
