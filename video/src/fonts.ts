import { loadFont as loadDisplay } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadSans } from "@remotion/google-fonts/Outfit";

const display = loadDisplay("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const sans = loadSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const displayFamily = display.fontFamily;
export const sansFamily = sans.fontFamily;
