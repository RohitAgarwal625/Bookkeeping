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
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: "translate(-4.5px, 2.5px)" }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="20" fontWeight="bold" fontFamily="serif">?</text>
        </svg>
      </div>
    </div>
  );
}
