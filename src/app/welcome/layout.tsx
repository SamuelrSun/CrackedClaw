import { Bodoni_Moda, Inter, Roboto, Playfair_Display } from "next/font/google";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  style: ["normal", "italic"],
  display: "swap",
});

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${bodoniModa.variable} ${inter.variable} ${roboto.variable} ${playfair.variable} min-h-screen`}
    >
      <style>{`
        @keyframes loginFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDots {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes panelUp {
          from { transform: translateY(0); }
          to { transform: translateY(-100%); }
        }
      `}</style>
      {children}
    </div>
  );
}
