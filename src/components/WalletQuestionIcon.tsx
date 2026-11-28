import { Wallet } from "lucide-react";

interface WalletQuestionIconProps {
  /** Wallet + "?" colour (defaults to the brand dark brown). */
  color?: string;
}

/**
 * Wallet with a "?" inside: the "Connect Pi Wallet" wallet-with-π icon (same wallet size,
 * same glyph size and offset) with π swapped for "?". Used for unidentified wallet addresses.
 */
export function WalletQuestionIcon({ color = "#592C16" }: WalletQuestionIconProps) {
  return (
    <div className="relative flex items-center justify-center w-10 h-10" aria-hidden="true">
      <Wallet className="w-9 h-9" style={{ color }} />
      {/* Same "?" as the Settings guest avatar (bold app font), centred between the wallet's
          left edge (x=3 of 24) and the clasp flap (x=16), and in the body's height (y=7..21). */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: "translate(-3.75px, 3px)" }}>
        <span className="font-bold" style={{ color, fontSize: "16px", lineHeight: 1 }}>?</span>
      </div>
    </div>
  );
}
