import { useState } from "react";
import { Share2, Users, Gift } from "lucide-react";
import { useDarkMode } from "../contexts/DarkModeContext";
import { shareInvite } from "../lib/invite";

interface InviteModalProps {
  /** The person being paid (contact name), or empty for an unsaved address. */
  name?: string;
  onClose: () => void;
}

const GRADIENT = "linear-gradient(to right, #592C16, #8A532B)";

/** "Bring 'em on bookkeeping.pi": paying someone not on the app is blocked; invite them instead. */
export function InviteModal({ onClose }: InviteModalProps) {
  const { isDarkMode: isDark } = useDarkMode();
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareInvite();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center"
      style={{ zIndex: 400, background: "rgba(0,0,0,0.5)", padding: "0 24px" }}
      onClick={onClose}
    >
      <style>{`@keyframes modal-pop { 0% { transform: scale(0.82); opacity: 0; } 70% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }`}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "360px",
          borderRadius: "16px",
          padding: "24px",
          background: isDark ? "#1A1D24" : "#ffffff",
          border: isDark ? "1px solid #2A2D35" : "none",
          animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <div
          className="relative flex items-center justify-center shadow-lg"
          style={{ width: "56px", height: "56px", borderRadius: "9999px", background: GRADIENT, margin: "0 auto 12px" }}
          aria-hidden="true"
        >
          {/* Refer & earn: people with a gift badge */}
          <Users className="w-7 h-7 text-white" />
          <span
            className="absolute flex items-center justify-center"
            style={{ right: "-2px", bottom: "-2px", width: "22px", height: "22px", borderRadius: "9999px", background: isDark ? "#1A1D24" : "#ffffff", border: "2px solid #8A532B" }}
          >
            <Gift className="w-3 h-3" style={{ color: isDark ? "#C08552" : "#592C16" }} />
          </span>
        </div>
        <h3
          id="invite-title"
          className="text-center"
          style={{ fontWeight: 700, fontSize: "18px", marginBottom: "6px", color: isDark ? "#F3F4F6" : "#111827" }}
        >
          Bring &rsquo;em on bookkeeping.pi
        </h3>
        <div className="text-sm text-center" style={{ marginBottom: "20px", color: isDark ? "#9CA3AF" : "#6B7280", lineHeight: 1.5 }}>
          <p style={{ marginBottom: "10px" }}>
            The person you want to transact with isn&rsquo;t registered on the app yet. In order to record the transaction for both of you, send an invite with your referral code.
          </p>
          <p>
            Both of you get a paid trial package of the app for free once your invitee makes the first transaction using the inbuilt &lsquo;Pay&rsquo; button.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={sharing}
          className="w-full flex items-center justify-center gap-2 text-white"
          style={{
            minHeight: "48px",
            borderRadius: "9999px",
            fontWeight: 700,
            marginBottom: "12px",
            background: GRADIENT,
            boxShadow: "0 6px 24px rgba(89,44,22,0.35)",
            opacity: sharing ? 0.7 : 1,
          }}
        >
          {sharing ? "Opening…" : "Share invite"}
          <Share2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-sm"
          style={{
            minHeight: "44px",
            borderRadius: "9999px",
            fontWeight: 600,
            color: isDark ? "#9CA3AF" : "#6B7280",
            border: isDark ? "1px solid #2A2D35" : "1px solid #E5E7EB",
            background: "transparent",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
