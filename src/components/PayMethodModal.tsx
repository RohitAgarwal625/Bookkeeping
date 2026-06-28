import { X, Users, QrCode } from "lucide-react";

interface PayMethodModalProps {
  onPayViaContacts: () => void;
  onPayViaQR: () => void;
  onClose: () => void;
}

export function PayMethodModal({ onPayViaContacts, onPayViaQR, onClose }: PayMethodModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] backdrop-blur-md bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Relative wrapper — positions card + outside X button together */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {/* X button OUTSIDE the card boundary */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
        </button>

        {/* Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-[90vw] max-w-[340px]">
          {/* Header — title only, no X inside */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-border text-center">
            <h3 className="font-semibold text-gray-900 dark:text-foreground">Pay</h3>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Choose payment method</p>
          </div>

          {/* Two options with vertical divider */}
          <div className="px-6 pb-6 pt-5 flex items-center gap-0">

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
            <div className="w-px bg-gray-100 dark:bg-border mx-4 self-stretch flex-shrink-0" />

            {/* Pay via Contacts */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <button onClick={onPayViaContacts} className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F7C548] to-[#A47CF3] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
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
