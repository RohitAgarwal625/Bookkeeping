import { ArrowLeft, Search, ChevronRight, ChevronDown, Check, CheckCircle, Home, Lock, UserPlus, BookOpen } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Contact, getInitials, PaymentIntent, Transaction } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { InviteModal } from "./InviteModal";
import { useDarkMode } from "../contexts/DarkModeContext";
import { ApiError } from "../lib/api";
import { usePaymentIntents } from "../hooks/useBookkeeping";
import {
  openPiWalletPayRequest, shortHash,
  PendingWalletPayment, loadPendingWalletPayment, savePendingWalletPayment, clearPendingWalletPayment, WALLET_POLL_LIMIT_MS,
} from "../lib/piWalletPay";

interface PayScreenProps {
  onBack: () => void;
  contacts?: Contact[];
  prefilledAddress?: string;
  onAddressUsed?: () => void;
  /** "Add Contact" for an address that isn't saved yet; gets the entered/scanned address. */
  onAddPioneer?: (walletAddress: string) => void;
  onNavigateToLedger?: (customerName: string, newTransactions?: Transaction[]) => void;
  /** The server confirmed the payment and saved it to the ledger: refresh contacts and totals. */
  onPaymentConfirmed?: (customerName: string, contactId: string) => void | Promise<void>;
  /** The user's own Pi wallet address (Settings → Profile); the server needs it to find the payment on the blockchain. */
  userWalletAddress?: string;
  onOpenSettings?: () => void;
}

type ScreenState = "form" | "processing" | "success";

const POLL_MS = 8000;
const POLL_LIMIT_MS = WALLET_POLL_LIMIT_MS;

const GRADIENT = "linear-gradient(to right, #592C16, #8A532B)";
const AMOUNT_PRESETS = ["3.14", "10", "50", "100", "500", "1000"];
/** Pi has 7 decimal places; the server rejects more. */
const AMOUNT_PATTERN = /^\d+(\.\d{1,7})?$/;
/** A Pi amount as plain text with up to 7 decimals (no exponent, no trailing zeros). */
const formatPi = (n: number) => n.toFixed(7).replace(/\.?0+$/, "");

export function PayScreen({ onBack, contacts, prefilledAddress, onAddressUsed, onAddPioneer, onNavigateToLedger, onPaymentConfirmed, userWalletAddress, onOpenSettings }: PayScreenProps) {
  const contactList = contacts || [];
  const intents = usePaymentIntents();

  // A payment still being waited for (its intent is saved before opening the Pi Wallet, which can
  // reload the app) brings the screen straight back to "Waiting for your payment".
  // Arriving from a QR scan opens the form for the scanned person instead; the pending payment
  // stays saved (it resumes the next time Pay opens without a scanned address).
  const [restored] = useState<PendingWalletPayment | null>(() => (prefilledAddress ? null : loadPendingWalletPayment()));
  const [publicKey, setPublicKey] = useState("");
  const [pioneerQuery, setPioneerQuery] = useState("");
  const [paidRecipientName, setPaidRecipientName] = useState(restored?.contactName ?? "");
  const [amount, setAmount] = useState(restored?.amountText ?? "");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenState>(restored ? "processing" : "form");
  const [isPublicKeyFocused, setIsPublicKeyFocused] = useState(false);
  // Waiting for the server to find the Pi Wallet payment on the blockchain
  const [walletOpened, setWalletOpened] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paidTxHash, setPaidTxHash] = useState("");
  // "This person isn't on the app yet" pop-up (the name of the person being paid).
  const [inviteName, setInviteName] = useState<string | null>(null);
  const payTarget = useRef<PendingWalletPayment | null>(restored);
  const checking = useRef(false);

  const { isDarkMode: isDark } = useDarkMode();

  // ── Helpers ────────────────────────────────────────────────────────────
  const findByAddress = (addr: string) =>
    contactList.find(
      (c) => c.piWalletAddress.trim().toLowerCase() === addr.trim().toLowerCase()
    ) ?? null;

  // The contact whose wallet address matches the typed Public key (source of truth)
  const matchedContact = publicKey.trim() ? findByAddress(publicKey) : null;
  const isVerified = matchedContact !== null;
  const recipientName = matchedContact?.name ?? "";

  // Pay requires: an address present + that address belongs to a saved contact + amount > 0
  const canPay = isVerified && amount !== "" && Number(amount) > 0 && !isStarting;

  // ── Prefill from QR scan (drops into Public key, auto-fills Pioneer if saved) ──
  useEffect(() => {
    if (prefilledAddress) {
      setPublicKey(prefilledAddress);
      const match = findByAddress(prefilledAddress);
      setPioneerQuery(match ? match.name : "");
      onAddressUsed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledAddress]);

  // ── Linked field handlers ──────────────────────────────────────────────
  const handlePublicKeyChange = (value: string) => {
    setPublicKey(value);
    const match = findByAddress(value);
    // Auto-fill / clear the Pioneer to stay in sync with the address
    setPioneerQuery(match ? match.name : "");
  };

  const handleSelectPioneer = (contact: Contact) => {
    setPublicKey(contact.piWalletAddress);
    setPioneerQuery(contact.name);
    setIsDropdownOpen(false);
    (document.activeElement as HTMLElement)?.blur();
  };

  const handlePioneerSearchChange = (value: string) => {
    setPioneerQuery(value);
    setPublicKey("");
    setIsDropdownOpen(true);
  };

  // Close dropdown on blur — delay so onMouseDown on contact fires first
  const handlePioneerBlur = () => {
    setTimeout(() => setIsDropdownOpen(false), 150);
  };

  const filteredContacts = contactList.filter((c) =>
    c.name.toLowerCase().includes(pioneerQuery.toLowerCase())
  );

  const resetForm = () => {
    payTarget.current = null;
    clearPendingWalletPayment();
    setPaidTxHash("");
    setScreen("form");
    setPublicKey("");
    setPioneerQuery("");
    setPaidRecipientName("");
    setAmount("");
    setIsDropdownOpen(false);
  };

  const askForOwnWallet = () => {
    toast.error("Add your own Pi wallet address in Settings → Profile first, so the app can confirm your payment.", {
      action: onOpenSettings ? { label: "Settings", onClick: onOpenSettings } : undefined,
    });
  };

  // Pay: create the payment intent on the server (it checks the receiver is on the app), then open
  // the Pi Wallet with the contact's address filled in (the amount is typed there) and wait until
  // the server finds that payment on the blockchain. Nothing is saved before that.
  const handlePay = async () => {
    if (!matchedContact || isStarting) return;
    if (!userWalletAddress) {
      askForOwnWallet();
      return;
    }
    const amountText = amount.trim();
    if (!AMOUNT_PATTERN.test(amountText) || !(Number(amountText) > 0)) {
      toast.error("Enter an amount greater than 0 with at most 7 decimal places.");
      return;
    }
    const contact = matchedContact;
    setIsStarting(true);
    let intent: PaymentIntent;
    try {
      // The typed string, not a float: the server stores it exactly.
      const res = await intents.create({ receiverAddress: contact.piWalletAddress, amount: amountText, contactId: contact.id });
      intent = res.intent;
    } catch (err) {
      if (err instanceof ApiError && err.code === "RECEIVER_NOT_ON_APP") {
        setInviteName(contact.name);
      } else if (err instanceof ApiError && err.code === "SENDER_WALLET_MISSING") {
        askForOwnWallet();
      } else if (err instanceof ApiError && err.code === "SELF_PAYMENT") {
        toast.error("This is your own wallet address. You can't pay yourself.");
      } else if (err instanceof ApiError && err.status === 0) {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      } else {
        toast.error(err instanceof Error ? err.message : "Couldn't start the payment. Please try again.");
      }
      return;
    } finally {
      setIsStarting(false);
    }

    setPaidRecipientName(contact.name);
    setPaidTxHash("");
    const target: PendingWalletPayment = {
      intentId: intent.id,
      contactId: contact.id,
      contactName: contact.name,
      contactAddress: contact.piWalletAddress,
      amountText,
      startedAt: Date.now(),
    };
    payTarget.current = target;
    savePendingWalletPayment(target); // before leaving the app: the Pi Browser may reload it
    setAmount(amountText);
    setScreen("processing");

    const opened = await openPiWalletPayRequest(contact.piWalletAddress);
    setWalletOpened(opened);
    if (!opened) {
      try {
        await navigator.clipboard.writeText(contact.piWalletAddress);
        toast("Couldn't open the Pi Wallet here. The address is copied: open your Pi Wallet and send the payment.");
      } catch {
        toast("Couldn't open the Pi Wallet here. Open your Pi Wallet and send the payment to the address shown.");
      }
    }
  };

  /** The intent is finished one way or another: leave the waiting screen. */
  const finishIntent = (target: PendingWalletPayment, intent: PaymentIntent) => {
    if (payTarget.current !== target) return; // cancelled meanwhile
    if (intent.status === "confirmed") {
      payTarget.current = null;
      clearPendingWalletPayment();
      setPaidRecipientName(target.contactName);
      // The amount actually sent on the chain (may differ from the typed one: it is typed again in the Pi Wallet).
      setAmount(intent.amount != null ? formatPi(intent.amount) : target.amountText);
      setPaidTxHash(shortHash(intent.txHash));
      setScreen("success");
      void Promise.resolve(onPaymentConfirmed?.(target.contactName, target.contactId)).catch((err) =>
        console.error("Refresh after a confirmed payment failed:", err)
      );
    } else if (intent.status === "expired") {
      payTarget.current = null;
      clearPendingWalletPayment();
      setScreen("form");
      toast.error("This payment wasn't found on the Pi blockchain in time and has expired. If you sent it, use Automatic Transaction to add it.", { duration: 7000 });
    } else if (intent.status === "cancelled") {
      payTarget.current = null;
      clearPendingWalletPayment();
      setScreen("form");
      toast("This payment was cancelled (a newer payment to the same person replaced it).");
    }
  };

  // Ask the server about the payment. `mode`: "poll" reads the intent (the server's background job
  // checks the blockchain), "check" asks the server to check the blockchain now.
  const checkForPayment = async (mode: "poll" | "check", manual: boolean) => {
    const target = payTarget.current;
    if (!target || checking.current) return;
    checking.current = true;
    if (manual) setIsChecking(true);
    try {
      const { intent } = mode === "check" ? await intents.check(target.intentId) : await intents.get(target.intentId);
      if (payTarget.current !== target) return; // cancelled meanwhile
      if (intent.status === "pending") {
        if (manual) toast("Payment not found on the Pi blockchain yet. It can take a few seconds after you confirm it in the Pi Wallet.");
        return;
      }
      finishIntent(target, intent);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Not this account's payment (e.g. signed in as someone else after a reload).
        if (payTarget.current === target) {
          payTarget.current = null;
          clearPendingWalletPayment();
          setScreen("form");
          if (manual) toast.error("This payment couldn't be found. Please start it again.");
        }
      } else if (err instanceof ApiError && err.status === 429) {
        if (manual) toast("Checked a moment ago. Please wait a few seconds and try again.");
      } else if (err instanceof ApiError && err.status === 401) {
        if (manual) toast.error("Please sign in with Pi again to check this payment.");
      } else {
        if (manual) toast.error("Couldn't reach the server. Check your connection and try again.");
        console.error("Payment check failed:", err);
      }
    } finally {
      checking.current = false;
      if (manual) setIsChecking(false);
    }
  };

  // Always call the latest checkForPayment (it reads the latest props, e.g. onPaymentConfirmed).
  const checkRef = useRef(checkForPayment);
  checkRef.current = checkForPayment;

  // Poll the intent while waiting; ask for a blockchain check right away on mount and whenever
  // the user returns from the Pi Wallet.
  useEffect(() => {
    if (screen !== "processing") return;
    const withinLimit = () => {
      const target = payTarget.current;
      return !!target && Date.now() - target.startedAt <= POLL_LIMIT_MS;
    };
    const poll = () => { if (withinLimit()) void checkRef.current("poll", false); };
    const checkNow = () => { if (withinLimit()) void checkRef.current("check", false); };
    checkNow();
    const id = window.setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") checkNow(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", checkNow);
    window.addEventListener("focus", checkNow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", checkNow);
      window.removeEventListener("focus", checkNow);
    };
  }, [screen]);

  const cancelWaiting = async () => {
    const target = payTarget.current;
    if (!target || isCancelling) return;
    setIsCancelling(true);
    try {
      const { intent } = await intents.cancel(target.intentId);
      if (intent.status === "confirmed") { finishIntent(target, intent); return; }
    } catch (err) {
      // The server checks the chain before cancelling; if it couldn't, nothing was cancelled.
      if (err instanceof ApiError && err.code === "CHAIN_UNAVAILABLE") {
        toast.error("Couldn't check the Pi blockchain, so the payment wasn't cancelled. Try again.");
        return;
      }
      // Not pending any more (e.g. confirmed a moment ago): show what it became.
      if (err instanceof ApiError && err.status !== 0 && err.status !== 404) {
        try {
          const { intent } = await intents.get(target.intentId);
          if (intent.status === "confirmed") { finishIntent(target, intent); return; }
        } catch { /* fall through: leave the waiting screen */ }
      } else if (err instanceof ApiError && err.status === 0) {
        toast.error("Couldn't reach the server, so the payment wasn't cancelled. Check your connection and try again.");
        return;
      }
    } finally {
      setIsCancelling(false);
    }
    if (payTarget.current !== target) return;
    payTarget.current = null;
    clearPendingWalletPayment();
    setScreen("form");
  };

  const reopenWallet = async () => {
    const target = payTarget.current;
    if (!target) return;
    const opened = await openPiWalletPayRequest(target.contactAddress);
    setWalletOpened(opened);
    if (!opened) toast("Couldn't open the Pi Wallet here. Open it yourself and send the payment.");
  };

  // ── Processing Screen (pulse / ripple animation — no spinner) ──────────
  if (screen === "processing") {
    return (
      <div className="bg-background" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", padding: "24px 32px" }}>
          {/* Pulsing coin with expanding ripple rings */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            {[0, 0.7, 1.4].map((delay) => (
              <span
                key={delay}
                className="absolute w-24 h-24 rounded-full"
                style={{
                  background: GRADIENT,
                  animation: "pay-ripple 2.1s ease-out infinite",
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl flex-shrink-0"
              style={{ background: GRADIENT, animation: "pay-bob 1.8s ease-in-out infinite" }}
            >
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="22" fontWeight="bold" fontFamily="serif">π</text>
              </svg>
            </div>
          </div>

          {/* Title + message (one group, so the free space is split evenly between the groups) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "24rem" }}>
          <p className="text-gray-900 dark:text-white font-bold text-xl mb-2">Waiting for your payment</p>
          <p className="text-gray-400 text-sm text-center">
            {walletOpened
              ? `Enter ${amount} π in your Pi Wallet and send it to ${paidRecipientName}. It is added to both ledgers once it appears on the Pi blockchain.`
              : `Send ${amount} π to ${paidRecipientName} from your Pi Wallet. It is added to both ledgers once it appears on the Pi blockchain.`}
          </p>
          </div>
          {/* Bouncing dots */}
          <div className="flex items-center gap-2">
            {[0, 0.16, 0.32].map((delay) => (
              <span
                key={delay}
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: GRADIENT,
                  animation: "pay-dot 1.2s ease-in-out infinite",
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "24rem" }}>
            <button
              onClick={() => void checkForPayment("check", true)}
              disabled={isChecking}
              className="w-full py-4 rounded-2xl font-bold text-base text-white"
              style={{ background: GRADIENT, boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)", opacity: isChecking ? 0.7 : 1 }}
            >
              {isChecking ? "Checking…" : "I've paid, check now"}
            </button>
            <button
              onClick={() => void reopenWallet()}
              className="w-full py-4 rounded-2xl border-2 border-gray-200 dark:border-border text-gray-700 dark:text-foreground font-bold text-base"
            >
              Open Pi Wallet again
            </button>
            <button
              onClick={() => void cancelWaiting()}
              disabled={isCancelling}
              className="w-full py-3 text-gray-500 dark:text-muted-foreground text-sm"
              style={{ minHeight: "44px", fontWeight: 600, opacity: isCancelling ? 0.6 : 1 }}
            >
              {isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pay-ripple { 0% { transform: scale(0.7); opacity: 0.55; } 100% { transform: scale(2.4); opacity: 0; } }
          @keyframes pay-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
          @keyframes pay-dot { 0%, 80%, 100% { transform: scale(0.5); opacity: 0.35; } 40% { transform: scale(1); opacity: 1; } }
        `}</style>
      </div>
    );
  }

  // ── Success Screen ─────────────────────────────────────────────────────
  if (screen === "success") {
    return (
      <div className="bg-background relative" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Soft on-theme glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: GRADIENT }}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: "32px", padding: "32px", paddingTop: "80px", position: "relative", zIndex: 10 }}>
          {/* Animated success badge */}
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: GRADIENT, boxShadow: "0 12px 40px rgba(89, 44, 22, 0.45)" }}>
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>

          <div className="text-center">
            <p className="text-gray-900 dark:text-white font-bold text-2xl mb-1">Done !</p>
            <p className="text-gray-400 text-sm text-center">
              Your payment is on the Pi blockchain & the transaction is added to your ledger.
            </p>
          </div>

          {/* Receipt card */}
          <div
            className="w-full max-w-sm bg-white dark:bg-card border border-gray-100 dark:border-border shadow-xl"
            style={{ borderRadius: "24px", overflow: "hidden", animation: "pay-fade-up 0.5s 0.12s both" }}
          >
            <div className="flex flex-col items-center py-6 border-b border-gray-100 dark:border-border">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-muted-foreground mb-1">Amount Paid</p>
              <p
                className="font-black text-gray-900 dark:text-foreground leading-none"
                style={{ fontSize: "clamp(2.5rem, 12vw, 3.5rem)" }}
              >
                {amount} π
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-muted-foreground text-sm">Paid To</span>
                <span className="text-gray-900 dark:text-foreground font-semibold text-sm">{paidRecipientName || recipientName || pioneerQuery || "Pioneer Contact"}</span>
              </div>

              {paidTxHash && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-muted-foreground text-sm">Transaction</span>
                  <span className="text-gray-900 dark:text-foreground font-semibold text-sm font-mono">{paidTxHash}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-muted-foreground text-sm">Status</span>
                <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-medium flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2 h-2" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  Successful
                </span>
              </div>
            </div>
          </div>

          {/* Open Ledger button below modal box — matching AutomaticTransactionScreen style */}
          <button
            onClick={() => {
              const targetName = paidRecipientName || recipientName || pioneerQuery || "Pioneer Contact";
              if (onNavigateToLedger) {
                onNavigateToLedger(targetName);
              }
            }}
            className="w-full max-w-sm py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 cursor-pointer relative z-30"
            style={{
              background: "linear-gradient(to right, #592C16, #7B3D1E)",
              boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)",
            }}
          >
            Open Ledger
            <BookOpen className="w-5 h-5" />
          </button>

          {/* Bottom actions — pinned to bottom via marginTop auto */}
          <div style={{ display: "flex", gap: "12px", width: "100%", maxWidth: "24rem", marginTop: "auto" }}>
            <button
              onClick={onBack}
              className="flex-1 py-4 rounded-2xl border-2 border-gray-200 dark:border-border text-gray-700 dark:text-foreground font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
            <button
              onClick={resetForm}
              className="flex-1 py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
              style={{ background: GRADIENT, boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)" }}
            >
              Pay Again
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pay-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
          @keyframes pay-fade-up { 0% { transform: translateY(14px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        `}</style>
      </div>
    );
  }

  // ── Payment Form (default) ─────────────────────────────────────────────
  return (
    <div className="bg-background" style={{ minHeight: "100dvh", height: "100dvh", display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px 220px" }}>
        {/* Public key */}
        <div>
          <label className="block text-base font-semibold text-gray-700 dark:text-foreground mb-2">
            Public Key
          </label>
          <div className="flex items-center bg-gray-50 dark:bg-secondary border-2 border-gray-100 dark:border-border focus-within:border-[#592C16] dark:focus-within:border-[#8A532B] rounded-2xl px-4 py-3.5 transition-all shadow-sm">
            <textarea
              value={!isPublicKeyFocused && publicKey.length > 10
                ? `${publicKey.slice(0, 5)}.....${publicKey.slice(-5)}`
                : publicKey}
              onChange={(e) => handlePublicKeyChange(e.target.value.replace(/[\r\n]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              onFocus={() => setIsPublicKeyFocused(true)}
              onBlur={() => setIsPublicKeyFocused(false)}
              placeholder="Pi Wallet Address"
              rows={isPublicKeyFocused && publicKey.length > 20 ? Math.min(4, Math.max(1, Math.ceil(publicKey.length / 20))) : 1}
              className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground outline-none text-base font-medium px-3 resize-none break-all leading-snug overflow-hidden"
            />
            {/* Vertical divider — 2px wide, clearly visible */}
            <div className="w-0.5 h-7 bg-gray-300 dark:bg-border mx-3 flex-shrink-0 rounded-full" />
            {/* Verification tick */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300 ${isVerified
                ? "bg-[#592C16] border-[#592C16]"
                : "bg-white dark:bg-card border-gray-300 dark:border-border"
                }`}
            >
              <Check
                className={`w-4 h-4 transition-colors duration-300 ${isVerified ? "text-white" : "text-gray-300 dark:text-muted-foreground"
                  }`}
                strokeWidth={3}
              />
            </div>
          </div>

          {/* Not-in-contacts message — displayed directly below Public Key field box (above 'or' divider) */}
          {publicKey.trim() && !isVerified && (
            <div className="mt-3 px-4 py-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed mb-3">
                The wallet address you entered is not saved in your Contact List. Kindly tap on the button given below to add it to your Contacts.
              </p>
              <button
                onClick={() => onAddPioneer?.(publicKey.trim())}
                className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(to right, #592C16, #7B3D1E)", boxShadow: "0 4px 16px rgba(89, 44, 22, 0.35)" }}
              >
                <span>Add Contact</span>
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* or */}
        <div style={{ marginTop: "28px", marginBottom: "28px" }} className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100 dark:bg-border" />
          <span className="text-sm font-medium text-gray-400 dark:text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-border" />
        </div>

        {/* Pioneer — searchbar + dropdown */}
        <div className="relative z-50">
          <label className="block text-base font-semibold text-gray-700 dark:text-foreground mb-2">
            Pioneer
          </label>
          {/* Visually disabled when wallet is typed but not found in contacts */}
          {publicKey.trim() && !isVerified ? (
            <div className="flex items-center gap-3 bg-gray-200 dark:bg-secondary border-2 border-dashed border-gray-300 dark:border-border rounded-2xl px-4 py-3.5 cursor-not-allowed">
              <Lock className="w-4 h-4 text-gray-400 dark:text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-gray-400 dark:text-muted-foreground text-base line-through select-none">
                Select from Contacts
              </span>
            </div>
          ) : (
            <div className={`flex items-center gap-3 bg-gray-50 dark:bg-secondary border-2 rounded-2xl px-4 py-3.5 transition-all shadow-sm border-gray-100 dark:border-border focus-within:border-gray-300 dark:focus-within:border-gray-600`}>
              <Search className="w-4 h-4 text-gray-400 dark:text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={pioneerQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={handlePioneerBlur}
                onChange={(e) => handlePioneerSearchChange(e.target.value)}
                placeholder="Select from Contacts"
                className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground outline-none text-base font-medium caret-black dark:caret-white"
              />
              <ChevronDown
                className={`w-4 h-4 text-gray-400 dark:text-muted-foreground flex-shrink-0 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>
          )}

          {isDropdownOpen && !(publicKey.trim() && !isVerified) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-2xl overflow-hidden z-50 max-h-64 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-muted-foreground px-4 pt-3 pb-1">
                Saved Contacts
              </p>
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact, i) => (
                  <div
                    key={contact.id}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectPioneer(contact); }}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-[#F5EDE6] dark:hover:bg-secondary cursor-pointer transition-colors ${i < filteredContacts.length - 1 ? "border-b border-gray-50 dark:border-border" : ""
                      }`}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#592C16] text-sm font-bold shadow-sm" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                      {getInitials(contact.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-foreground font-medium truncate">{contact.name}</p>
                      <p className="text-gray-400 dark:text-muted-foreground text-xs truncate font-mono">{contact.piWalletAddress.length > 10 ? `${contact.piWalletAddress.slice(0, 5)}.....${contact.piWalletAddress.slice(-5)}` : contact.piWalletAddress}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-muted-foreground flex-shrink-0" />
                  </div>
                ))
              ) : (
                <p className="px-4 py-4 text-sm text-gray-400 dark:text-muted-foreground">No matching contacts</p>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div style={{ marginTop: "36px" }}>
          <label className="block text-base font-semibold text-gray-700 dark:text-foreground mb-4 text-center">
            Amount
          </label>

          <div className="flex items-center justify-center w-full mb-8">
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || Number(val) >= 0) setAmount(val);
              }}
              min="0"
              placeholder="0.0000001"
              className="bg-transparent text-center font-black text-black dark:text-foreground outline-none w-full placeholder-gray-200 dark:placeholder-gray-700 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none leading-none"
              style={{ fontSize: "clamp(2.5rem, 13vw, 4.25rem)", fontVariantNumeric: "tabular-nums" }}
            />
            <span
              className="font-black text-gray-300 dark:text-muted-foreground ml-2 leading-none select-none"
              style={{ fontSize: "clamp(2rem, 9vw, 3rem)" }}
            >
              π
            </span>
          </div>

          {/* Quick amount chips */}
          <div className="flex gap-2 flex-wrap justify-center">
            {AMOUNT_PRESETS.map((preset) => {
              const isSelected = amount === preset;
              return (
                <button
                  key={preset}
                  onClick={() => setAmount(preset)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${isSelected
                    ? "text-white shadow-md border-0"
                    : "bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:border-[#592C16] dark:hover:border-[#8A532B] hover:text-[#592C16] dark:hover:text-[#EFC8AC]"
                    }`}
                  style={isSelected ? { background: GRADIENT } : undefined}
                >
                  {preset} π
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Pay button container (no background card/panel behind it) */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div
          style={{ paddingBottom: "48px", paddingTop: "16px", paddingLeft: "20px", paddingRight: "20px" }}
        >
          {(isVerified || amount) && (
            <div className="mb-4 bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {isVerified ? (
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-[#592C16] text-base font-bold shadow-md flex-shrink-0" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                    {getInitials(recipientName)}
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center flex-shrink-0">
                    <Search className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mb-0.5">Paying to</p>
                  <p className="text-gray-900 dark:text-foreground font-semibold text-sm truncate">
                    {recipientName || "Select recipient"}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pl-3">
                <p className="text-xs text-gray-500 dark:text-muted-foreground mb-0.5">Amount</p>
                <p className={`font-black text-lg leading-none ${amount ? "text-[#592C16] dark:text-[#EFC8AC]" : "text-gray-300 dark:text-muted-foreground"}`}>
                  {amount ? `${amount} π` : "— π"}
                </p>
              </div>
            </div>
          )}

          <button
            disabled={!canPay}
            onClick={() => void handlePay()}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:cursor-not-allowed"
            style={{
              background: !canPay ? (isDark ? "#252830" : "#e5e7eb") : GRADIENT,
              boxShadow: !canPay ? "none" : "0 6px 24px rgba(89, 44, 22, 0.45), 0 2px 8px rgba(138, 83, 43, 0.25)",
              color: !canPay ? (isDark ? "#9a9aa5" : "#9ca3af") : "#fff",
            }}
          >
            {isStarting ? "Starting…" : "Pay"}
          </button>
        </div>
      </div>

      {inviteName !== null && <InviteModal name={inviteName} onClose={() => setInviteName(null)} />}
    </div>
  );
}

// ── Shared header: "Payment Details" centered + Bookkeeping logo on the right ──────
function Header({ onBack, hideBack = false }: { onBack: () => void; hideBack?: boolean }) {
  return (
    <header className="flex-shrink-0 bg-white dark:bg-card shadow-sm border-b border-gray-200 dark:border-border">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="w-9">
          {!hideBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-secondary hover:bg-gray-200 dark:hover:bg-secondary/80 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-foreground" />
            </button>
          )}
        </div>
        <h1 className="font-bold text-gray-900 dark:text-foreground text-lg text-center">Payment Details</h1>
        <BookkeepingLogo compact />
      </div>
    </header>
  );
}

