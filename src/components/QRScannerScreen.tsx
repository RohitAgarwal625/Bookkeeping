import { useState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerScreenProps {
  onBack: () => void;
  onScanned: (walletAddress: string) => void;
}

export function QRScannerScreen({ onBack, onScanned }: QRScannerScreenProps) {
  const [status, setStatus] = useState<"scanning" | "error" | "success">("scanning");
  const [error, setError] = useState("");
  const [scannedValue, setScannedValue] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-container";
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded: string) => {
          setScannedValue(decoded);
          setStatus("success");
          scanner.stop().catch(() => {});
        },
        () => { /* ignore frame errors */ }
      )
      .catch((err: unknown) => {
        setError(String(err));
        setStatus("error");
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  if (status === "success") {
    return (
      <div className="size-full flex flex-col items-center justify-center bg-white dark:bg-[#0F1115] px-8 gap-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)" }}>
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <p className="text-gray-900 dark:text-foreground font-bold text-xl mb-2">QR Scanned!</p>
          <p className="text-gray-500 dark:text-muted-foreground text-sm mb-2">Wallet Address:</p>
          <p className="text-gray-800 dark:text-gray-200 font-mono text-xs bg-gray-50 dark:bg-secondary rounded-xl px-4 py-3 break-all">
            {scannedValue}
          </p>
        </div>
        <button onClick={() => onScanned(scannedValue)}
          className="w-full py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)", boxShadow: "0 6px 24px rgba(164,124,243,0.4)" }}>
          Pay this Address
        </button>
        <button onClick={onBack} className="text-gray-400 text-sm underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-[#0a0a0a] relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 px-6 py-5 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full bg-black/40 backdrop-blur-sm">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <p className="text-white font-semibold">Scan Pi Wallet QR</p>
      </header>

      {/* Camera view */}
      <div className="flex-1 flex items-center justify-center">
        <div id={containerId} className="w-full" />
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-8 text-center">
            <p className="text-white font-bold text-lg mb-2">Camera Unavailable</p>
            <p className="text-gray-400 text-sm mb-6">{error || "Please allow camera permission and try again."}</p>
            <button onClick={onBack} className="px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold">Go Back</button>
          </div>
        )}
      </div>

      {/* Viewfinder overlay */}
      {status === "scanning" && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-64 h-64 relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#A47CF3] rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#A47CF3] rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#A47CF3] rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#A47CF3] rounded-br-lg" />
            <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-[#A47CF3] to-transparent"
              style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }} />
          </div>
          <p className="text-white text-sm mt-6 text-center px-8 opacity-80">
            Point camera at a Pi Wallet QR code
          </p>
          <style>{`@keyframes scanLine { 0%,100% { top: 10%; } 50% { top: 90%; } }`}</style>
        </div>
      )}
    </div>
  );
}
