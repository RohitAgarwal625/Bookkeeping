import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { isPiPublicKey } from "../lib/piBlockchain";
import { ensurePiInitialized } from "../lib/piAuth";

interface QRScannerScreenProps {
  onBack: () => void;
  /** A Pi wallet address was scanned; App opens Pay with it prefilled. */
  onScanned: (walletAddress: string) => void;
}

const NOT_AN_ADDRESS = "This QR code doesn't contain a Pi wallet address.";

/** Stops the camera scanner if it is running (stop() throws when it isn't). */
function stopScanner(scanner: Html5Qrcode | null) {
  try {
    if (scanner?.isScanning) scanner.stop().catch(() => {});
  } catch { /* not running */ }
}

/**
 * True when the app runs inside a Pi host page (Pi Browser / App Studio iframe), the only
 * place Pi SDK native calls get an answer. A plain browser tab would wait 2 minutes for a
 * reply that never comes, so the native scanner is skipped there.
 */
function inPiHost(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

/**
 * The Pi wallet address in a scanned QR text, or null. Accepts a plain "G…" address
 * (spaces/line breaks and lower case tolerated) or one inside a pi:// link, URL,
 * "publicKey=…" or JSON payload. Rejects text with no address or with two different ones.
 */
export function extractPiAddress(raw: string): string | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const plain = text.replace(/\s+/g, "").toUpperCase();
  if (isPiPublicKey(plain)) return plain;
  let decoded = text;
  try { decoded = decodeURIComponent(text); } catch { /* keep the raw text */ }
  const found = new Set(Array.from(decoded.matchAll(/(?:^|[^A-Za-z0-9])(G[A-Z2-7]{55})(?![A-Za-z0-9])/g), (m) => m[1]));
  return found.size === 1 ? [...found][0] : null;
}

export function QRScannerScreen({ onBack, onScanned }: QRScannerScreenProps) {
  const [status, setStatus] = useState<"scanning" | "error">("scanning");
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-container";
  const startedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Latest callbacks, so the history effect below runs once (App passes new functions each render).
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;
  // Set once an address is scanned: the popstate that removes our history entry then runs it.
  const leaveActionRef = useRef<(() => void) | null>(null);
  // The web scanner can report the same code on several frames: only the first one counts.
  const scannedRef = useRef(false);

  /** Leaves the scanner for Pay with the scanned address, removing our history entry first. */
  const showScanned = (address: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    if (window.history.state?.screen === "qrScanner") {
      leaveActionRef.current = () => onScannedRef.current(address);
      window.history.back();
    } else {
      onScannedRef.current(address);
    }
  };

  const handleUploadQR = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // so picking the same image again still triggers a scan

    // Stop camera first if running
    stopScanner(scannerRef.current);

    const uploadScanner = new Html5Qrcode("qr-upload-hidden");
    uploadScanner
      .scanFile(file, /* showImage */ false)
      .then((decoded) => {
        const address = extractPiAddress(decoded);
        if (!address) {
          toast.error(NOT_AN_ADDRESS, { id: "qr-not-address" });
          return;
        }
        showScanned(address);
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

    let unmounted = false;
    let startPromise: Promise<unknown> | null = null;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    // In-page camera scanner (html5-qrcode): the fallback when Pi's native scanner isn't available.
    const startWebScanner = () => {
      if (unmounted) return;
      startPromise = scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded: string) => {
            const address = extractPiAddress(decoded);
            if (!address) {
              // Keep scanning; one toast (same id) however many frames see the code.
              toast.error(NOT_AN_ADDRESS, { id: "qr-not-address" });
              return;
            }
            showScanned(address);
            stopScanner(scanner);
          },
          () => { /* ignore frame errors */ }
        )
        .catch((err: unknown) => {
          if (unmounted) return;
          setError(String(err));
          setStatus("error");
        });
    };

    // Pi Browser: try Pi's native QR scanner first. Any failure (camera permission denied,
    // older Pi Browser, desktop) falls back to the in-page scanner.
    const tryNativeScanner = async (): Promise<boolean> => {
      if (!inPiHost()) return false;
      try {
        await ensurePiInitialized();
        if (typeof window.Pi?.scanQrCode !== "function") return false;
        const text = await window.Pi.scanQrCode({ facingMode: "environment" });
        if (unmounted) return true;
        if (text === null) {
          // The user closed Pi's scanner.
          handleBack();
          return true;
        }
        const address = extractPiAddress(text);
        if (!address) {
          toast.error(NOT_AN_ADDRESS, { id: "qr-not-address" });
          return false; // let them try again with the in-page scanner
        }
        showScanned(address);
        return true;
      } catch (err) {
        console.warn("[QR] Pi native scanner unavailable, using the in-page camera:", err);
        return false;
      }
    };

    tryNativeScanner().then((handled) => {
      if (!handled) startWebScanner();
    });

    return () => {
      unmounted = true;
      // start() may still be opening the camera: stop it once it has.
      if (startPromise) startPromise.then(() => stopScanner(scanner));
      else stopScanner(scanner);
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
      const leave = leaveActionRef.current;
      if (leave) leave();
      else onBackRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function handleBack() {
    if (window.history.state?.screen === "qrScanner") {
      window.history.back();
    } else {
      onBackRef.current();
    }
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
                background: "linear-gradient(to right, #592C16, #8A532B)",
                boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)",
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
            <div className="relative flex items-center justify-center" style={{ width: '250px', height: '250px' }}>
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
              <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-[#B55A38] to-transparent"
                style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }} />

              {/* Centered instruction text */}
              <p className="text-white text-sm text-center px-4 opacity-80 z-10 select-none">
                Point camera at a Pi Wallet QR code
              </p>
            </div>
            <style>{`@keyframes scanLine { 0%,100% { top: 10%; } 50% { top: 90%; } }`}</style>
          </div>
          {/* Upload QR button — perfectly centered single-line floating pill */}
          <div className="fixed bottom-0 left-0 right-0 pb-8 pt-4 flex justify-center z-50 pointer-events-none">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="pointer-events-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm shadow-lg transition-transform active:scale-95 whitespace-nowrap"
              style={{
                background: "linear-gradient(to right, #592C16, #8A532B)",
                boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)",
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
