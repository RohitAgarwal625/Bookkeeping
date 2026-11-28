import { Prisma, type Contact, type PaymentIntent } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { fetchAccountPayments, type HorizonPaymentRecord } from "./horizon";
import {
  hashLockKey,
  importInTransaction,
  isRetryableImportError,
  lockKeys,
  LOCKED_TX_OPTIONS,
  paymentLockKey,
  type ImportEntry,
} from "../controllers/transactions.controller";

/**
 * In-app payments (Pay via contacts / Pay via QR): server-side confirmation from Horizon
 * and the ledger rows it writes. The blockchain proves money moved; the intent (created
 * by the signed-in sender) says who paid whom. Nothing here trusts the client.
 */

export const INTENT_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Payments up to this long before the intent was created still count (clock skew, slow click). */
const LOOKBACK_MS = 2 * 60 * 1000;
/** Horizon pages (200 payments each, newest first) read per check at most. */
const MAX_PAGES = 5;

/** Same normalization as contact and wallet addresses: no whitespace, upper case. */
export function normalizeAddress(address: string): string {
  return address.replace(/\s+/g, "").toUpperCase();
}

/**
 * Advisory-lock key for "this user's ledger": the wallet-change wipe (users.controller.ts)
 * takes it, and so does every in-app payment write into that user's ledger, so a row is
 * never written between the wipe and ledgerResetAt being set.
 */
export function ledgerLockKey(userId: string): string {
  return `ledger:${userId}`;
}

/**
 * True when the user's ledger was reset (wallet address changed) after this intent was
 * created: the intent then never writes a row into that user's ledger.
 */
function resetAfter(ledgerResetAt: Date | null | undefined, intent: Pick<PaymentIntent, "createdAt">): boolean {
  return !!ledgerResetAt && intent.createdAt.getTime() < ledgerResetAt.getTime();
}

/** Advisory-lock key for one intent (job and /check may run at the same time). */
function intentLockKey(id: string): string {
  return `intent:${id}`;
}
/** Advisory-lock key for "which intent owns this Horizon payment op". */
function intentOpLockKey(chainPaymentId: string): string {
  return `intentop:${chainPaymentId}`;
}
/** Advisory-lock key for "one pending intent per sender -> receiver". */
export function intentPairLockKey(senderId: string, receiverId: string): string {
  return `intentpair:${senderId}:${receiverId}`;
}

function parseAmount(raw: string | undefined): Prisma.Decimal | null {
  if (!raw || !/^\d+(\.\d{1,7})?$/.test(raw)) return null;
  const d = new Prisma.Decimal(raw);
  return d.gt(0) ? d : null;
}

function compareRecords(a: HorizonPaymentRecord, b: HorizonPaymentRecord): number {
  const t = Date.parse(a.created_at!) - Date.parse(b.created_at!);
  if (t !== 0) return t;
  const x = BigInt(a.id);
  const y = BigInt(b.id);
  return x === y ? 0 : x < y ? -1 : 1;
}

/**
 * Horizon payments that would confirm this intent, earliest first: a native-Pi `payment`
 * op from senderAddress to receiverAddress, successful, created at or after
 * createdAt - 2 min (and not after expiresAt), whatever its amount. The amount typed in
 * the app is NOT matched: the Pi Wallet link can't carry it, so the user types it again in
 * the wallet and may send a different amount. The chain's amount is the confirmed one.
 * `failed` lists the same kind of payment whose transaction FAILED on the chain (Horizon
 * `transaction_successful: false`, read with include_failed=true), made at or after
 * createdAt (no look-back: an earlier attempt's failure must not fail a new intent).
 */
async function findCandidates(
  intent: PaymentIntent
): Promise<{ ok: HorizonPaymentRecord[]; failed: HorizonPaymentRecord[] }> {
  const from = intent.createdAt.getTime() - LOOKBACK_MS;
  const until = intent.expiresAt.getTime();
  const found: HorizonPaymentRecord[] = [];
  const failed: HorizonPaymentRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const records = await fetchAccountPayments(intent.senderAddress, {
      order: "desc",
      limit: 200,
      cursor,
      includeFailed: true,
    });
    let reachedOlder = false;
    for (const r of records) {
      const t = Date.parse(r.created_at ?? "");
      if (Number.isNaN(t)) continue;
      if (t < from) {
        reachedOlder = true;
        continue;
      }
      if (t > until) continue;
      if (r.type !== "payment" || r.asset_type !== "native") continue;
      if (!r.id || !/^\d{1,30}$/.test(r.id)) continue;
      if (normalizeAddress(r.from ?? "") !== intent.senderAddress) continue;
      if (normalizeAddress(r.to ?? "") !== intent.receiverAddress) continue;
      const amount = parseAmount(r.amount);
      if (!amount) continue;
      if (r.transaction_hash && !/^[0-9a-fA-F]{64}$/.test(r.transaction_hash)) continue;
      if (r.transaction_successful === false) {
        if (t >= intent.createdAt.getTime()) failed.push(r);
        continue;
      }
      found.push(r);
    }
    if (reachedOlder || records.length < 200) break;
    cursor = records[records.length - 1]?.paging_token;
    if (!cursor) break;
  }
  return { ok: found.sort(compareRecords), failed: failed.sort(compareRecords) };
}

/**
 * True while an intent can still change after a check: pending, or failed and not past
 * expiresAt (the user may retry in the Pi Wallet after a failed transaction; a successful
 * retry still confirms it). A failed intent is final once it expires, or once a newer
 * intent to the same receiver replaces it (createIntent moves its expiresAt to now).
 */
export function isOpenIntent(intent: PaymentIntent, now: number = Date.now()): boolean {
  return intent.status === "pending" || (intent.status === "failed" && intent.expiresAt.getTime() > now);
}

/** The user's contact with this address (older rows compared normalized), or null. */
async function findContactByAddress(
  db: Prisma.TransactionClient,
  userId: string,
  address: string
): Promise<Pick<Contact, "id" | "name"> | null> {
  const rows = await db.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Contact"
    WHERE "userId" = ${userId}
      AND upper(regexp_replace("piWalletAddress", '[[:space:]]', '', 'g')) = ${address}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function sentDescription(name: string): string {
  return `Paid via app to ${name}`;
}
function receivedDescription(name: string): string {
  return `Received via app from ${name}`;
}

/** Runs fn in a locked transaction, retried like the import on races/deadlocks/timeouts. */
async function inLockedTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, LOCKED_TX_OPTIONS);
    } catch (err) {
      if (!isRetryableImportError(err) || attempt >= 3) throw err;
    }
  }
}

/** Writes one ledger row through the import's dedup/link rules and returns its id. */
async function writeLedgerRow(
  tx: Prisma.TransactionClient,
  userId: string,
  contactId: string,
  entry: ImportEntry
): Promise<string | null> {
  await importInTransaction(tx, userId, contactId, [entry]);
  const row = await tx.transaction.findFirst({
    where: { userId, chainPaymentId: entry.chainPaymentId },
    select: { id: true },
  });
  if (row) await relabelScanRow(tx, row.id, entry.description);
  return row?.id ?? null;
}

/** Note the Automatic scan / Auto Sync gives the rows it saves (src/lib/piBlockchain.ts). */
const SCAN_NOTE_PREFIX = "Auto Sync:";

/**
 * An in-app payment that a scan (Auto Sync every 10s, or the Automatic fetch) saved before
 * the intent was confirmed keeps the scan's "Auto Sync: ..." note, so it read as an Auto Sync
 * entry instead of a payment made via the app. Give such a row the in-app note. Notes the
 * user wrote (manual rows linked to the payment) are left alone.
 */
async function relabelScanRow(tx: Prisma.TransactionClient, rowId: string, description: string): Promise<void> {
  await tx.transaction.updateMany({
    where: { id: rowId, description: { startsWith: SCAN_NOTE_PREFIX } },
    data: { description },
  });
}

type ConfirmOutcome = { kind: "done"; intent: PaymentIntent } | { kind: "op_taken" };

/**
 * Confirms the intent with this Horizon payment in ONE DB transaction: claims the payment
 * op for the intent, then writes the sender's debit row (under intent.contactId or the
 * sender's contact with receiverAddress) and the receiver's credit row (under the
 * receiver's contact with senderAddress), both through importInTransaction. A side
 * without a contact gets its row later, when that contact is created.
 */
async function confirmWith(intentId: string, rec: HorizonPaymentRecord): Promise<ConfirmOutcome> {
  return inLockedTransaction(async (tx) => {
    const current = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
    const txHash = rec.transaction_hash ? rec.transaction_hash.toLowerCase() : undefined;
    await lockKeys(tx, [
      intentLockKey(intentId),
      intentOpLockKey(rec.id),
      paymentLockKey(current.senderId, rec.id),
      paymentLockKey(current.receiverId, rec.id),
      ledgerLockKey(current.senderId),
      ledgerLockKey(current.receiverId),
      ...(txHash ? [hashLockKey(current.senderId, txHash), hashLockKey(current.receiverId, txHash)] : []),
    ]);
    // Re-read under the lock: a concurrent check may have confirmed or cancelled it.
    // A failed intent can still be confirmed (a successful retry in the Pi Wallet).
    const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
    if (intent.status !== "pending" && intent.status !== "failed") return { kind: "done", intent };
    const taken = await tx.paymentIntent.findFirst({
      where: { chainPaymentId: rec.id, id: { not: intentId } },
      select: { id: true },
    });
    if (taken) return { kind: "op_taken" };

    const amount = new Prisma.Decimal(rec.amount!);
    const paidAt = new Date(rec.created_at!);

    // Sender: the contact picked on Pay (if it still exists and is theirs), else by address.
    let senderContact: Pick<Contact, "id" | "name"> | null = null;
    if (intent.contactId) {
      senderContact = await tx.contact.findFirst({
        where: { id: intent.contactId, userId: intent.senderId },
        select: { id: true, name: true },
      });
    }
    senderContact ??= await findContactByAddress(tx, intent.senderId, intent.receiverAddress);
    let receiverContact = await findContactByAddress(tx, intent.receiverId, intent.senderAddress);

    // A party whose ledger was reset (wallet address changed) after this intent was created
    // gets no row; the other party's row is still written.
    const parties = await tx.user.findMany({
      where: { id: { in: [intent.senderId, intent.receiverId] } },
      select: { id: true, ledgerResetAt: true },
    });
    const resetAt = new Map(parties.map((p) => [p.id, p.ledgerResetAt]));
    if (resetAfter(resetAt.get(intent.senderId), intent)) senderContact = null;
    if (resetAfter(resetAt.get(intent.receiverId), intent)) receiverContact = null;

    const senderTransactionId = senderContact
      ? await writeLedgerRow(tx, intent.senderId, senderContact.id, {
          chainPaymentId: rec.id,
          description: sentDescription(senderContact.name),
          amount,
          type: "debit",
          timestamp: paidAt.toISOString(),
          txHash,
        })
      : null;
    const receiverTransactionId = receiverContact
      ? await writeLedgerRow(tx, intent.receiverId, receiverContact.id, {
          chainPaymentId: rec.id,
          description: receivedDescription(receiverContact.name),
          amount,
          type: "credit",
          timestamp: paidAt.toISOString(),
          txHash,
        })
      : null;

    const confirmed = await tx.paymentIntent.update({
      where: { id: intentId },
      data: {
        status: "confirmed",
        // The payment's time on the chain (History shows and sorts by it).
        confirmedAt: paidAt,
        chainPaymentId: rec.id,
        txHash: txHash ?? null,
        // The chain's amount is the confirmed one (replaces the typed amount; QR has none).
        amount,
        senderTransactionId,
        receiverTransactionId,
        ...(senderContact && !intent.contactId ? { contactId: senderContact.id } : {}),
      },
    });
    return { kind: "done", intent: confirmed };
  });
}

/**
 * Checks an open intent (isOpenIntent) against Horizon now. Confirms it with the earliest
 * matching successful payment whose op id no other intent uses. Otherwise a pending intent
 * with a matching FAILED transaction on the chain becomes "failed" (txHash, amount and
 * confirmedAt = that transaction's hash, amount and chain time; it can still be confirmed
 * by a successful retry until expiresAt), and a pending one past expiresAt with nothing
 * matched becomes "expired". Other intents are returned unchanged. Horizon errors are
 * thrown (the caller decides: /check answers with the still-pending intent, the job logs).
 */
export async function checkIntent(intent: PaymentIntent): Promise<PaymentIntent> {
  if (!isOpenIntent(intent)) return intent;
  const { ok: candidates, failed } = await findCandidates(intent);
  if (candidates.length > 0) {
    const used = new Set(
      (
        await prisma.paymentIntent.findMany({
          where: { chainPaymentId: { in: candidates.map((c) => c.id) }, id: { not: intent.id } },
          select: { chainPaymentId: true },
        })
      ).map((r) => r.chainPaymentId)
    );
    for (const rec of candidates) {
      if (used.has(rec.id)) continue;
      const outcome = await confirmWith(intent.id, rec);
      if (outcome.kind === "done") return outcome.intent;
    }
  }
  if (intent.status === "pending" && failed.length > 0) {
    // A failed transaction another intent already shows (e.g. an earlier attempt) isn't this one's.
    const hashes = failed.map((r) => r.transaction_hash?.toLowerCase()).filter((h): h is string => !!h);
    const shown = new Set(
      (
        await prisma.paymentIntent.findMany({
          where: { txHash: { in: hashes }, id: { not: intent.id } },
          select: { txHash: true },
        })
      ).map((r) => r.txHash)
    );
    const rec = failed.find((r) => !r.transaction_hash || !shown.has(r.transaction_hash.toLowerCase()));
    if (rec) {
      await prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: "pending" },
        data: {
          status: "failed",
          txHash: rec.transaction_hash ? rec.transaction_hash.toLowerCase() : null,
          // The attempted amount and its time on the chain (History shows and sorts by it).
          amount: new Prisma.Decimal(rec.amount!),
          confirmedAt: new Date(rec.created_at!),
        },
      });
      return prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    }
  }
  if (intent.status === "pending" && intent.expiresAt.getTime() <= Date.now()) {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: "pending" },
      data: { status: "expired" },
    });
  }
  return prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
}

/**
 * Cancels a pending intent only after checking the chain: runs checkIntent first (same
 * matching), so an intent whose payment is already on Horizon is confirmed (ledger rows
 * and all) instead of cancelled; past expiresAt with no match it expires. Only a still
 * pending intent is then cancelled. Horizon errors are thrown with the intent unchanged
 * (never cancel what we couldn't check). Non-pending intents are returned unchanged.
 */
export async function cancelAfterCheck(intent: PaymentIntent): Promise<PaymentIntent> {
  if (intent.status !== "pending") return intent;
  const checked = await checkIntent(intent);
  if (checked.status !== "pending") return checked;
  await prisma.paymentIntent.updateMany({
    where: { id: intent.id, status: "pending" },
    data: { status: "cancelled" },
  });
  return prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
}

/**
 * After a user saves a contact: writes the ledger rows of the confirmed in-app payments
 * between the user and that contact's address that are not in the user's ledger yet
 * (received ones the user had no contact for, sent ones without a contact), and moves
 * rows left without a contact by an earlier contact delete into it (importInTransaction's
 * orphan relink). Rows the user deleted stay deleted.
 */
export async function backfillContactPayments(
  userId: string,
  contact: Pick<Contact, "id" | "name" | "piWalletAddress">
): Promise<void> {
  const address = normalizeAddress(contact.piWalletAddress);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ledgerResetAt: true } });
  const intents = await prisma.paymentIntent.findMany({
    where: {
      status: "confirmed",
      chainPaymentId: { not: null },
      // Payments from before the user's ledger reset (wallet address change) stay out of it.
      ...(user?.ledgerResetAt ? { createdAt: { gte: user.ledgerResetAt } } : {}),
      OR: [
        { senderId: userId, receiverAddress: address },
        { receiverId: userId, senderAddress: address },
      ],
    },
    orderBy: { confirmedAt: "asc" },
  });
  if (intents.length === 0) return;

  const entries: ImportEntry[] = intents.map((i) => {
    const sent = i.senderId === userId;
    return {
      chainPaymentId: i.chainPaymentId!,
      description: sent ? sentDescription(contact.name) : receivedDescription(contact.name),
      amount: i.amount!,
      type: sent ? "debit" : "credit",
      timestamp: (i.confirmedAt ?? i.createdAt).toISOString(),
      txHash: i.txHash ?? undefined,
    };
  });

  await inLockedTransaction(async (tx) => {
    await lockKeys(tx, [ledgerLockKey(userId)]);
    // A wallet-change wipe that committed after the read above deletes this contact too:
    // write nothing then.
    const still = await tx.contact.findFirst({ where: { id: contact.id, userId }, select: { id: true } });
    if (!still) return;
    await importInTransaction(tx, userId, contact.id, entries);
    const rows = await tx.transaction.findMany({
      where: { userId, chainPaymentId: { in: entries.map((e) => e.chainPaymentId) } },
      select: { id: true, chainPaymentId: true },
    });
    const byOp = new Map(rows.map((r) => [r.chainPaymentId!, r.id]));
    for (const e of entries) {
      const rowId = byOp.get(e.chainPaymentId);
      if (rowId) await relabelScanRow(tx, rowId, e.description);
    }
    for (const i of intents) {
      const rowId = byOp.get(i.chainPaymentId!);
      if (!rowId) continue;
      if (i.senderId === userId && !i.senderTransactionId) {
        await tx.paymentIntent.updateMany({
          where: { id: i.id, senderTransactionId: null },
          data: { senderTransactionId: rowId },
        });
      } else if (i.receiverId === userId && !i.receiverTransactionId) {
        await tx.paymentIntent.updateMany({
          where: { id: i.id, receiverTransactionId: null },
          data: { receiverTransactionId: rowId },
        });
      }
    }
  });
}
