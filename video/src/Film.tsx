import { Audio } from "@remotion/media";
import { AbsoluteFill, Series, staticFile, useVideoConfig } from "remotion";
import { CardsScene } from "./scenes/CardsScene";
import { ProductScreen } from "./scenes/ProductScreen";
import { StatementScene } from "./scenes/StatementScene";

const SITE = "https://campuscart-web-h46s.onrender.com/";

export const Film: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Audio src={staticFile("voiceover/prahlad.mp3")} name="Voiceover" volume={1} />
      <Audio src={staticFile("music/bed.mp3")} name="Music" volume={0.16} />
      <Series>
        <Series.Sequence name="Hook" durationInFrames={282} premountFor={fps}>
          <CardsScene
            kicker="On campus tonight"
            title="Three businesses."
            cards={[
              { label: "Food", title: "Rice stall", detail: "Wok-fresh, between classes." },
              { label: "Coffee", title: "Coffee cart", detail: "Under the neem tree." },
              { label: "Lending", title: "A projector", detail: "You bring it back." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Both" durationInFrames={291} premountFor={fps}>
          <CardsScene
            kicker="Student and business"
            title={"She runs it.\nHe orders."}
            cards={[
              { label: "Seller", title: "Her stall", detail: "A student, and a business." },
              { label: "Buyer", title: "His order", detail: "Standing at the counter." },
              { label: "UniCart", title: "Both of them", detail: "One marketplace." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Form" durationInFrames={214} premountFor={fps}>
          <StatementScene
            kicker="Before UniCart"
            title={"A form collects\na name."}
            support="UniCart keeps the price, the payment, and what happened next."
          />
        </Series.Sequence>
        <Series.Sequence name="Live" durationInFrames={431} premountFor={fps}>
          <ProductScreen
            shot="screens/live/featured.png"
            kicker="The live counter"
            title="If she didn’t write it, it doesn’t stay."
            caption={SITE}
          />
        </Series.Sequence>
        <Series.Sequence name="Offers" durationInFrames={284} premountFor={fps}>
          <CardsScene
            kicker="Her offer"
            title="The server does the math."
            cards={[
              { label: "New account", title: "10% off", detail: "Campus Brewers. NEWBREW." },
              { label: "Her code", title: "₹20 off", detail: "Rice, on orders from ₹90." },
              { label: "Checkout", title: "Calculated", detail: "The buyer never sends the discount." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Pay" durationInFrames={239} premountFor={fps}>
          <CardsScene
            kicker="Payment"
            title="YouPI signs it."
            cards={[
              { label: "Wallet", title: "Campus credits", detail: "He pays from the balance." },
              { label: "Counter", title: "Cash", detail: "When her stall still takes it." },
              { label: "UPI", title: "Signed", detail: "The credit lands with the signature." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Trail" durationInFrames={182} premountFor={fps}>
          <CardsScene
            kicker="After the order"
            title="It stays open."
            cards={[
              { label: "Status", title: "Ready", detail: "Placed. Accepted. Being made." },
              { label: "Lending", title: "Back", detail: "The projector returns to the shelf." },
              { label: "Chat", title: "Same order", detail: "Then he leaves a review." },
            ]}
          />
        </Series.Sequence>
        <Series.Sequence name="Close" durationInFrames={173} premountFor={fps}>
          <StatementScene
            kicker="React  ·  FastAPI  ·  MongoDB"
            title="That’s UniCart."
            support={SITE}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
