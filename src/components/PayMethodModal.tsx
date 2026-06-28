import { X, Users, QrCode } from "lucide-react";

interface PayMethodModalProps {
  onPayViaContacts: () => void;
  onPayViaQR: () => void;
  onClose: () => void;
}

export function PayMethodModal({ onPayViaContacts, onPayViaQR, onClose }: PayMethodModalProps) {
  return (
    <>
      <div className="fixed inset-0 z-50 backdrop-blur-md bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none">
        <div className="pointer-events-auto relative">
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
          </button>
          <div className="animate-scale-in bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-72">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-border text-center">
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Pay</h3>
              <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Choose payment method</p>
            </div>
            <div className="px-5 py-6 flex justify-around">
              <button onClick={onPayViaQR} className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                  <QrCode className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Pay via QR</span>
              </button>
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
    </>
  );
}
