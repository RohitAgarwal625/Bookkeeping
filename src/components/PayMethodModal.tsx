import { X, Users, QrCode } from "lucide-react";

interface PayMethodModalProps {
  onPayViaContacts: () => void;
  onPayViaQR: () => void;
  onClose: () => void;
}

export function PayMethodModal({ onPayViaContacts, onPayViaQR, onClose }: PayMethodModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] backdrop-blur-sm bg-black/40 flex items-center justify-center px-6"
      onClick={onClose}
    >
      <style>{`@keyframes modal-pop { 0% { transform: scale(0.82); opacity: 0; } 70% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }`}</style>
      <div
        className="relative w-full max-w-[420px]"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <div
          className="bg-white dark:bg-card rounded-2xl w-full relative"
          style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,0.95), 0 0 28px 6px rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.2)" }}
        >
          {/* X — top-right outer corner */}
          <button
            onClick={onClose}
            className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 z-20 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
          </button>

          {/* Title */}
          <div className="px-5 pt-4 text-center">
            <h3 className="font-semibold text-gray-900 dark:text-foreground">Pay</h3>
          </div>
          {/* Separator */}
          <div className="h-px bg-gray-100 dark:bg-border mx-5 mt-3 mb-2" />
          {/* Subtitle */}
          <p className="text-xs text-gray-500 dark:text-muted-foreground text-center pb-1">Choose payment method</p>

          {/* Two columns */}
          <div className="px-6 pb-6 pt-3 flex items-start gap-0">
            {/* Pay via QR */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <button onClick={onPayViaQR} className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                  <QrCode className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Pay via QR</span>
              </button>
            </div>

            {/* Vertical divider */}
            <div className="w-px bg-gray-100 dark:bg-border mx-6 self-stretch flex-shrink-0" />

            {/* Pay via Contacts */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <button onClick={onPayViaContacts} className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Pay via Contacts</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
