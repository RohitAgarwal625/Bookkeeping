import { useState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle, Upload } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadQR = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Stop camera first if running
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }

    const uploadScanner = new Html5Qrcode("qr-upload-hidden");
    uploadScanner
      .scanFile(file, /* showImage */ false)
      .then((decoded) => {
        setScannedValue(decoded);
        setStatus("success");
      })
      .catch(() => {
        setError("Could not read QR code from the image. Please try another image.");
        setStatus("error");
      })
      .finally(() => {
        uploadScanner.clear();
      });
  };

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

  // Remove the library's shaded region from the DOM to eliminate the grey vertical line.
  // We replicate its appearance (dark overlay + white corners) in our own viewfinder overlay.
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const observer = new MutationObserver(() => {
      const shadedRegion = document.getElementById("qr-shaded-region");
      if (shadedRegion) {
        shadedRegion.remove();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    // Also remove if already present
    const existing = document.getElementById("qr-shaded-region");
    if (existing) existing.remove();
    return () => observer.disconnect();
  }, []);

  // Handle mobile hardware/gesture/browser back button navigation
  useEffect(() => {
    window.history.pushState({ screen: "qrScanner" }, "");
    const handlePopState = () => {
      onBack();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [onBack]);

  const handleBack = () => {
    if (window.history.state?.screen === "qrScanner") {
      window.history.back();
    } else {
      onBack();
    }
  };

  if (status === "success") {
    return (
      <div className="fixed inset-0 min-h-[100dvh] flex flex-col items-center justify-center bg-[#0a0a0a] text-white px-8 gap-6 z-[100]">
        {/* Header Back Button */}
        <header className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors active:scale-95"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <p className="text-white font-semibold">QR Scanned</p>
        </header>

        <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)" }}>
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-xl mb-2">QR Scanned!</p>
          <p className="text-gray-400 text-sm mb-2">Wallet Address:</p>
          <p className="text-gray-200 font-mono text-xs bg-white/10 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 break-all">
            {scannedValue}
          </p>
        </div>
        <button onClick={() => onScanned(scannedValue)}
          className="w-full py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)", boxShadow: "0 6px 24px rgba(164,124,243,0.4)" }}>
          Pay this Address
        </button>
        <button onClick={handleBack} className="text-gray-400 text-sm underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 min-h-[100dvh] w-full flex flex-col bg-[#0a0a0a] z-[100] overflow-hidden">
      {/* CSS overrides for html5-qrcode injected elements to guarantee full-screen video without letterboxing */}
      <style>{`
        #qr-reader-container {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          padding: 0 !important;
          border: none !important;
          overflow: hidden !important;
          background: #0a0a0a !important;
        }
        #qr-reader-container video {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          object-fit: cover !important;
          z-index: 1 !important;
        }
        #qr-shaded-region {
          display: none !important;
        }
        #qr-reader-container canvas {
          display: none !important;
        }
      `}</style>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={handleBack}
          className="p-2.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 transition-colors active:scale-95 cursor-pointer"
          aria-label="Go Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <p className="text-white font-semibold">Scan Pi Wallet QR</p>
      </header>

      {/* Camera view */}
      <div className="absolute inset-0 w-full h-full bg-[#0a0a0a] overflow-hidden">
        <div id={containerId} className="w-full h-full" />
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-8 text-center z-20">
            <p className="text-white font-bold text-lg mb-2">Camera Unavailable</p>
            <p className="text-gray-400 text-sm mb-6">{error || "Please allow camera permission and try again."}</p>
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-xl bg-white/10 text-white font-semibold mb-6 hover:bg-white/20 transition-colors border border-white/20 active:scale-95"
            >
              Go Back
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm shadow-lg transition-transform active:scale-95 whitespace-nowrap"
              style={{
                background: "linear-gradient(135deg, #6F3C97 0%, #A47CF3 100%)",
                boxShadow: "0 6px 24px rgba(111,60,151,0.45)",
              }}
            >
              <span className="whitespace-nowrap">Upload QR Image</span>
              <Upload className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Viewfinder overlay — exact replica of html5-qrcode's shaded region + white corner brackets from commit b50e8224 */}
      {status === "scanning" && (
        <>
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
            {/* 250x250 focus box with darkened surround and white corner brackets */}
            <div className="relative" style={{ width: '250px', height: '250px' }}>
              {/* Darkened overlay outside the focus box — matches library's rgba(0,0,0,0.48) */}
              <div className="absolute inset-0" style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.48)' }} />

              {/* 8 white corner bracket divs — pixel-exact match to html5-qrcode insertShaderBorders */}
              {/* Top-left horizontal */}
              <div style={{ position: 'absolute', top: '-5px', left: '0px', width: '40px', height: '5px', backgroundColor: '#ffffff' }} />
              {/* Top-left vertical */}
              <div style={{ position: 'absolute', top: '-5px', left: '-5px', width: '5px', height: '45px', backgroundColor: '#ffffff' }} />
              {/* Top-right horizontal */}
              <div style={{ position: 'absolute', top: '-5px', right: '0px', width: '40px', height: '5px', backgroundColor: '#ffffff' }} />
              {/* Top-right vertical */}
              <div style={{ position: 'absolute', top: '-5px', right: '-5px', width: '5px', height: '45px', backgroundColor: '#ffffff' }} />
              {/* Bottom-left horizontal */}
              <div style={{ position: 'absolute', bottom: '-5px', left: '0px', width: '40px', height: '5px', backgroundColor: '#ffffff' }} />
              {/* Bottom-left vertical */}
              <div style={{ position: 'absolute', bottom: '-5px', left: '-5px', width: '5px', height: '45px', backgroundColor: '#ffffff' }} />
              {/* Bottom-right horizontal */}
              <div style={{ position: 'absolute', bottom: '-5px', right: '0px', width: '40px', height: '5px', backgroundColor: '#ffffff' }} />
              {/* Bottom-right vertical */}
              <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', width: '5px', height: '45px', backgroundColor: '#ffffff' }} />

              {/* Animated scan line */}
              <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-[#A47CF3] to-transparent"
                style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }} />
            </div>
            <p className="text-white text-sm mt-6 text-center px-8 opacity-80">
              Point camera at a Pi Wallet QR code
            </p>
            <style>{`@keyframes scanLine { 0%,100% { top: 10%; } 50% { top: 90%; } }`}</style>
          </div>
          {/* Upload QR button — perfectly centered single-line floating pill */}
          <div className="fixed bottom-0 left-0 right-0 pb-8 pt-4 flex justify-center z-50 pointer-events-none">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="pointer-events-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm shadow-lg transition-transform active:scale-95 whitespace-nowrap"
              style={{
                background: "linear-gradient(135deg, #6F3C97 0%, #A47CF3 100%)",
                boxShadow: "0 6px 24px rgba(111,60,151,0.45)",
              }}
            >
              <span className="whitespace-nowrap">Upload QR Image</span>
              <Upload className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </>
      )}

      {/* Hidden file input for QR upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadQR}
        style={{ display: "none", position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />

      {/* Hidden container for upload-based QR scanning */}
      <div id="qr-upload-hidden" style={{ display: "none" }} />
    </div>
  );
}
