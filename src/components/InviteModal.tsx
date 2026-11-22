import { useState } from "react";
import { Share2, UserPlus } from "lucide-react";
import { useDarkMode } from "../contexts/DarkModeContext";
import { shareInvite } from "../lib/invite";

interface InviteModalProps {
  /** The person being paid (contact name), or empty for an unsaved address. */
  name?: string;
  onClose: () => void;
}

const GRADIENT = "linear-gradient(to right, #592C16, #8A532B)";

/** "This person isn't on the app yet": paying them is blocked; invite them instead. */
export function InviteModal({ name, onClose }: InviteModalProps) {
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

  const who = name?.trim() ? name.trim() : "This person";

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
          className="flex items-center justify-center shadow-lg"
          style={{ width: "56px", height: "56px", borderRadius: "9999px", background: GRADIENT, margin: "0 auto 12px" }}
        >
          <UserPlus className="w-7 h-7 text-white" />
        </div>
        <h3
          id="invite-title"
          className="text-center"
          style={{ fontWeight: 700, fontSize: "18px", marginBottom: "6px", color: isDark ? "#F3F4F6" : "#111827" }}
        >
          This person isn't on the app yet
        </h3>
        <p className="text-sm text-center" style={{ marginBottom: "20px", color: isDark ? "#9CA3AF" : "#6B7280", lineHeight: 1.5 }}>
          {who} hasn't joined Bookkeeping with this wallet address, so the payment can't be recorded for both of you.
          Invite them: once they sign in and add his address in Settings → Profile, you can pay them here.
        </p>
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
          <Share2 className="w-4 h-4" />
          {sharing ? "Opening…" : "Share invite"}
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
