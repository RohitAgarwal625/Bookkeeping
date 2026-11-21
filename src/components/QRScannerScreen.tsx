import { useState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle, Copy, Upload, UserPlus } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { cleanWalletInput, isPiPublicKey } from "../lib/piBlockchain";
import { ensurePiInitialized } from "../lib/piAuth";
import { openPiWalletLink, piWalletLinkForScan } from "../lib/piWalletPay";
import { normalizeContactName } from "../types";
import { ApiError } from "../lib/api";
import { usePaymentIntents } from "../hooks/useBookkeeping";
import { InviteModal } from "./InviteModal";

interface QRScannerScreenProps {
  onBack: () => void;
  /** Saved contacts, to find the one whose wallet address was scanned. */
  contacts: { name: string; piWalletAddress: string }[];
  /** Saves a new contact (same path as Add Contact). Resolves true when saved. */
  onSaveContact: (name: string, walletAddress: string) => Promise<boolean>;
  /** The Pi Wallet was opened to pay this contact; App toasts and leaves the scanner. */
  onWalletOpened: (contactName: string) => void;
  isGuest?: boolean;
  onTriggerGuestModal?: () => void;
  /** Opens Settings (to add the user's own wallet address, needed to confirm the payment). */
  onOpenSettings?: () => void;
}

/** Same limit as the backend's contact name (sanitizedString(1, 100)). */
const NAME_MAX_LENGTH = 100;

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

export function QRScannerScreen({ onBack, contacts, onSaveContact, onWalletOpened, isGuest, onTriggerGuestModal, onOpenSettings }: QRScannerScreenProps) {
  const intents = usePaymentIntents();
  // Creating the payment intent (the server checks the scanned person is on the app).
  const [isStarting, setIsStarting] = useState(false);
  // "This person isn't on the app yet" pop-up: the contact's name, or "" for an unsaved address.
  const [inviteName, setInviteName] = useState<string | null>(null);
  const [status, setStatus] = useState<"scanning" | "error" | "success">("scanning");
  const [error, setError] = useState("");
  // The full scanned text (shown on screen) and the Pi address found in it.
  const [scannedText, setScannedText] = useState("");
  const [scannedValue, setScannedValue] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  // The Pi Wallet couldn't be opened: show the address to copy instead.
  const [openFailed, setOpenFailed] = useState(false);
  // "Save this contact" pop-up for an address that isn't a saved contact yet.
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-container";
  const startedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Latest callbacks, so the history effect below runs once (App passes new functions each render).
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // Set once the Pi Wallet is open: the popstate that removes our history entry then runs it.
  const leaveActionRef = useRef<(() => void) | null>(null);

  const showScanned = (text: string, address: string) => {
    setScannedText(text.trim());
    setScannedValue(address);
    setStatus("success");
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
        showScanned(decoded, address);
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
            showScanned(decoded, address);
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
        showScanned(text, address);
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

  // Leave the scanner after the wallet opened, removing our history entry first.
  const leaveAfterOpening = (contactName: string) => {
    if (window.history.state?.screen === "qrScanner") {
      leaveActionRef.current = () => onWalletOpened(contactName);
      window.history.back();
    } else {
      onWalletOpened(contactName);
    }
  };

  /** Opens the scanned pay link in the Pi Wallet for a saved contact. */
  const openWalletFor = async (contactName: string) => {
    setIsOpening(true);
    const opened = await openPiWalletLink(piWalletLinkForScan(scannedText, scannedValue));
    setIsOpening(false);
    if (opened) leaveAfterOpening(contactName);
    else setOpenFailed(true);
  };

  const findContact = () => {
    const key = cleanWalletInput(scannedValue);
    return contacts.find((c) => cleanWalletInput(c.piWalletAddress ?? "") === key);
  };

  /**
   * Creates the payment intent (no amount: it's typed in the Pi Wallet) so the server confirms the
   * payment in the background. Returns false, after telling the user why, when paying is blocked.
   */
  const startIntent = async (contactName: string): Promise<boolean> => {
    setIsStarting(true);
    try {
      await intents.create({ receiverAddress: scannedValue });
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "RECEIVER_NOT_ON_APP") {
        setInviteName(contactName);
      } else if (err instanceof ApiError && err.code === "SENDER_WALLET_MISSING") {
        toast.error("Add your own Pi wallet address in Settings → Profile first, so the app can confirm your payment.", {
          action: onOpenSettings ? { label: "Settings", onClick: onOpenSettings } : undefined,
        });
      } else if (err instanceof ApiError && err.code === "SELF_PAYMENT") {
        toast.error("This is your own wallet address. You can't pay yourself.");
      } else if (err instanceof ApiError && err.status === 0) {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      } else {
        toast.error(err instanceof Error ? err.message : "Couldn't start the payment. Please try again.");
      }
      return false;
    } finally {
      setIsStarting(false);
    }
  };

  const handlePayThisAddress = async () => {
    if (isOpening || isStarting) return;
    if (isGuest) { onTriggerGuestModal?.(); return; }
    const contact = findContact();
    // Blocked (and the invite pop-up shown) before saving a contact or opening the wallet.
    if (!(await startIntent(contact?.name ?? ""))) return;
    if (contact) {
      void openWalletFor(contact.name);
    } else {
      setNewName("");
      setShowSaveDialog(true);
    }
  };

  const handleSaveAndPay = async () => {
    if (isSaving) return;
    if (isGuest) { onTriggerGuestModal?.(); return; }
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) {
      toast.error("Please enter a name for this contact.");
      return;
    }
    if (contacts.some((c) => normalizeContactName(c.name) === normalizeContactName(name))) {
      toast.error(`The name "${name}" is already taken. You must enter another name.`);
      return;
    }
    setIsSaving(true);
    let saved = false;
    try {
      saved = await onSaveContact(name, scannedValue);
    } finally {
      setIsSaving(false);
    }
    if (!saved) return; // onSaveContact already showed why
    setShowSaveDialog(false);
    await openWalletFor(name);
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(scannedValue);
      toast.success("Wallet address copied");
    } catch {
      toast.error("Couldn't copy. Please select the address and copy it.");
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
        <div className="text-center w-full">
          <p className="text-white font-bold text-xl mb-2">QR Scanned!</p>
          <p className="text-gray-400 text-sm mb-2">Wallet Address:</p>
          <p className="font-mono text-xs rounded-xl px-4 py-3"
            style={{ color: "#e5e7eb", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)", wordBreak: "break-all", textAlign: "left" }}>
            {scannedText || scannedValue}
          </p>
        </div>

        {openFailed ? (
          <div className="w-full rounded-2xl p-4 text-center"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="text-white text-sm mb-1" style={{ fontWeight: 600 }}>Couldn't open the Pi Wallet</p>
            <p className="text-gray-400 text-xs mb-3">Open Pi Wallet → Send and paste the address:</p>
            <p className="font-mono text-xs mb-3" style={{ color: "#e5e7eb", wordBreak: "break-all" }}>{scannedValue}</p>
            <button
              onClick={handleCopyAddress}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-white text-sm"
              style={{ minHeight: "44px", fontWeight: 600, background: "linear-gradient(135deg,#A47CF3,#F7C548)" }}
            >
              <Copy className="w-4 h-4" />
              Copy Address
            </button>
          </div>
        ) : (
          <button onClick={() => void handlePayThisAddress()} disabled={isOpening || isStarting}
            className="w-full py-4 rounded-2xl font-bold text-white text-base"
            style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)", boxShadow: "0 6px 24px rgba(164,124,243,0.4)", opacity: isOpening || isStarting ? 0.7 : 1 }}>
            {isStarting ? "Checking…" : isOpening ? "Opening Pi Wallet…" : "Pay this Address"}
          </button>
        )}
        <button onClick={handleBack} className="text-gray-400 text-sm underline" style={{ minHeight: "44px", padding: "0 16px" }}>
          {openFailed ? "Done" : "Cancel"}
        </button>

        {showSaveDialog && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center px-6"
            style={{ zIndex: 300, background: "rgba(0,0,0,0.5)" }}
            onClick={() => { if (!isSaving) setShowSaveDialog(false); }}>
            <style>{`@keyframes modal-pop { 0% { transform: scale(0.82); opacity: 0; } 70% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }`}</style>
            <form
              className="relative w-full bg-white dark:bg-card rounded-2xl p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-contact-title"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => { e.preventDefault(); void handleSaveAndPay(); }}
              style={{ maxWidth: "360px", animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both", boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)" }}
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center mx-auto mb-3 shadow-lg">
                <UserPlus className="w-7 h-7 text-white" />
              </div>
              <h3 id="save-contact-title" className="font-bold text-gray-900 dark:text-foreground text-lg mb-1 text-center">Save this contact</h3>
              <p className="text-sm text-gray-500 dark:text-muted-foreground mb-4 text-center">
                Save the pioneer first, so the payment goes to their ledger.
              </p>
              <label htmlFor="qr-contact-name" className="block text-sm font-medium text-gray-900 dark:text-foreground mb-1">Name</label>
              <input
                id="qr-contact-name"
                type="text"
                autoFocus
                required
                maxLength={NAME_MAX_LENGTH}
                value={newName}
                onChange={(e) => setNewName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                placeholder="Full Name"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all mb-3"
              />
              <label htmlFor="qr-contact-wallet" className="block text-sm font-medium text-gray-900 dark:text-foreground mb-1">Wallet Address</label>
              <input
                id="qr-contact-wallet"
                type="text"
                readOnly
                value={scannedValue}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-muted-foreground font-mono text-xs"
                style={{ textOverflow: "ellipsis", marginBottom: "20px" }}
              />
              <button
                type="submit"
                disabled={isSaving || !newName.trim()}
                className="w-full py-3 rounded-full text-white font-bold mb-3"
                style={{ background: "linear-gradient(to right, #A47CF3, #F7C548)", opacity: isSaving || !newName.trim() ? 0.6 : 1 }}
              >
                {isSaving ? "Saving…" : "Save & Pay"}
              </button>
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                disabled={isSaving}
                className="w-full py-3 rounded-full text-gray-500 dark:text-muted-foreground border border-gray-200 dark:border-border text-sm"
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {inviteName !== null && <InviteModal name={inviteName} onClose={() => setInviteName(null)} />}
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
              <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-[#A47CF3] to-transparent"
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
