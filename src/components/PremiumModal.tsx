import React, { useState } from "react";
import { X, Sparkles, CheckCircle2, ShieldCheck, Zap, BarChart3, AlertCircle, Loader2 } from "lucide-react";
import { createPremiumPayment, PREMIUM_PRODUCT } from "../lib/piPayments";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isAlreadyPremium?: boolean;
}

type PaymentStep = "idle" | "approving" | "signing" | "completing" | "success" | "error";

export function PremiumModal({
  isOpen,
  onClose,
  onSuccess,
  isAlreadyPremium = false,
}: PremiumModalProps) {
  const [step, setStep] = useState<PaymentStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePay = async () => {
    setStep("approving");
    setErrorMessage(null);

    try {
      await createPremiumPayment({
        onApproval: (paymentId) => {
          console.log("[PremiumModal] Payment approved on server:", paymentId);
          setStep("signing");
        },
        onCompletion: (paymentId, txid) => {
          console.log("[PremiumModal] Payment completed on server:", paymentId, txid);
          setStep("completing");
        },
        onCancel: () => {
          setStep("error");
          setErrorMessage("Payment was cancelled in Pi Wallet.");
        },
        onError: (err) => {
          setStep("error");
          setErrorMessage(err.message || "Payment encountered an unexpected error.");
        },
      });

      setStep("success");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setStep("error");
      const msg = err instanceof Error ? err.message : "Payment processing failed";
      setErrorMessage(msg);
    }
  };

  const handleReset = () => {
    setStep("idle");
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[200] backdrop-blur-sm bg-black/50 flex items-center justify-center px-4">
      <style>{`
        @keyframes modal-pop {
          0% { transform: scale(0.85); opacity: 0; }
          70% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        className="relative w-full max-w-[460px]"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <div
          className="bg-white dark:bg-card rounded-3xl w-full relative overflow-hidden border border-purple-100 dark:border-border shadow-2xl"
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-[#8A2BE2] via-[#7B1FA2] to-[#F7C548] p-6 text-white text-center overflow-hidden">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 backdrop-blur-sm flex items-center justify-center transition-colors text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md mb-3 shadow-inner">
              <Sparkles className="w-7 h-7 text-[#FFD700]" />
            </div>

            <h3 className="text-xl font-bold tracking-tight">
              {PREMIUM_PRODUCT.name}
            </h3>
            <p className="text-xs text-white/80 mt-1 max-w-[320px] mx-auto">
              Elevate your business bookkeeping with unlimited ledgers, exports, and Pi Network verification
            </p>

            <div className="mt-4 inline-flex items-baseline gap-1.5 bg-black/25 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20">
              <span className="text-2xl font-black text-[#FFD700] tracking-tight">{PREMIUM_PRODUCT.amount}</span>
              <span className="text-sm font-semibold tracking-wide uppercase text-white">π Pi</span>
              <span className="text-xs text-white/70 font-normal">/ lifetime</span>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {isAlreadyPremium ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-foreground text-base">
                  You are a Premium Member!
                </h4>
                <p className="text-xs text-gray-500 dark:text-muted-foreground max-w-sm mx-auto">
                  All features of the Premium Bookkeeping Plan are currently unlocked and active on your account.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 w-full py-3 rounded-xl bg-gray-100 dark:bg-secondary font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-secondary/80 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : step === "idle" ? (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300">
                    <BarChart3 className="w-4 h-4 text-[#8A2BE2] mt-0.5 shrink-0" />
                    <span><strong>Advanced Financial Analytics:</strong> Visual revenue trends, cash flow velocity, and smart metrics.</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300">
                    <Zap className="w-4 h-4 text-[#F7C548] mt-0.5 shrink-0" />
                    <span><strong>Instant Reports & Exports:</strong> Download clean CSV and PDF statement reports in one click.</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span><strong>Pi Blockchain Verification:</strong> Real-time reconciliation & cryptographic transaction history.</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handlePay}
                    className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#8A2BE2] to-[#7B1FA2] hover:opacity-95 active:scale-[0.99] shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Pay {PREMIUM_PRODUCT.amount} π with Pi Browser</span>
                    <Sparkles className="w-4 h-4 text-[#FFD700]" />
                  </button>
                  <p className="text-[11px] text-center text-gray-400 dark:text-muted-foreground mt-2">
                    Secured by Pi Network Payments SDK (User-to-App U2A)
                  </p>
                </div>
              </div>
            ) : step === "approving" || step === "signing" || step === "completing" ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-purple-50 dark:bg-purple-950/40 text-[#8A2BE2] flex items-center justify-center mx-auto animate-pulse">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-foreground text-sm">
                    {step === "approving" && "Requesting Server Approval..."}
                    {step === "signing" && "Waiting for Pi Wallet Confirmation..."}
                    {step === "completing" && "Finalizing Transaction on Pi Network..."}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1 max-w-xs mx-auto">
                    {step === "approving" && "Connecting to Bookkeeping backend and Pi Platform API..."}
                    {step === "signing" && "Please review and confirm the 1 π payment inside your Pi Wallet modal."}
                    {step === "completing" && "Server is verifying the blockchain transaction ID..."}
                  </p>
                </div>
              </div>
            ) : step === "success" ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-foreground text-base">
                    🎉 Payment Successful!
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 max-w-xs mx-auto">
                    You have unlocked the <strong>{PREMIUM_PRODUCT.name}</strong>. All premium bookkeeping tools are now active.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-sm text-white hover:opacity-95 shadow-md shadow-emerald-600/20 transition-all"
                >
                  Continue to Bookkeeping
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-foreground text-sm">
                    Payment Could Not Complete
                  </h4>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs mx-auto break-words">
                    {errorMessage || "An unexpected error occurred during payment."}
                  </p>
                  {errorMessage?.includes("PI_NETWORK_API_KEY") && (
                    <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-secondary/50 p-2.5 rounded-lg text-left">
                      <strong>Developer Note:</strong> To approve payments on server, set your <code>PI_NETWORK_API_KEY</code> from the Pi Developer Portal (<code>develop.pi</code>) in <code>backend/.env</code>.
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-border text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2.5 rounded-xl bg-[#8A2BE2] text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
