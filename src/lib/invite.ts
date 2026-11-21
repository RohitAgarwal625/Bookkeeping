/**
 * Invite someone who isn't on the app yet (Pay blocks payments to wallet addresses
 * that no app user has saved in Settings → Profile).
 */
import { toast } from "sonner";
import { ensurePiInitialized } from "./piAuth";

/** The app's public link sent in invites. The one place to change it. */
export const APP_INVITE_URL = "https://bookkeepvrku8726.pinet.com";

export const INVITE_TITLE = "Join me on Bookkeeping";

export function inviteMessage(): string {
  return (
    "I'd like to pay you in Pi with Bookkeeping, the ledger app for Pi pioneers. " +
    "Open it in the Pi Browser, sign in with Pi and add your wallet address in Settings → Profile: " +
    APP_INVITE_URL
  );
}

/**
 * Shares the invite: the Pi Browser's share sheet when available, else the
 * system share sheet, else copies the text to the clipboard.
 */
export async function shareInvite(): Promise<void> {
  const message = inviteMessage();
  try {
    // Don't wait forever for a Pi SDK that never answers (plain browser tab).
    await Promise.race([
      ensurePiInitialized(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Pi SDK timeout")), 3000)),
    ]);
    if (typeof window.Pi?.openShareDialog === "function") {
      window.Pi.openShareDialog(INVITE_TITLE, message);
      return;
    }
  } catch {
    // Not in the Pi Browser (or the SDK didn't load): try the other ways.
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: INVITE_TITLE, text: message });
      return;
    } catch (err) {
      // The user closed the share sheet: nothing else to do.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(message);
    toast.success("Invite copied. Paste it in a chat to send it.");
  } catch {
    toast.error(`Couldn't share the invite. Send them this link: ${APP_INVITE_URL}`);
  }
}
