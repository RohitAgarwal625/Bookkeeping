import type { Contact, PaymentIntent, Transaction, User } from "@prisma/client";

/**
 * Serializers convert Prisma models into API responses.
 * Critically, they convert Prisma `Decimal` -> JS `number` for the frontend.
 * 7 decimal places (Pi precision) fits safely within JS number precision.
 */

export function serializeUser(user: User) {
  return {
    id: user.id,
    piWalletAddress: user.piWalletAddress,
    piUsername: user.piUsername,
    piUid: user.piUid,
    displayName: user.displayName,
    walletPublicKey: user.walletPublicKey,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeTransaction(tx: Transaction) {
  return {
    id: tx.id,
    description: tx.description,
    amount: Number(tx.amount.toString()),
    type: tx.type,
    source: tx.source,
    txHash: tx.txHash,
    piPaymentId: tx.piPaymentId,
    chainPaymentId: tx.chainPaymentId,
    status: tx.status,
    timestamp: tx.timestamp.toISOString(),
    userId: tx.userId,
    contactId: tx.contactId,
  };
}

/**
 * Serialize a Contact. Totals/lastSeen are computed by the raw SQL query
 * and passed in separately (they are not columns on the Contact model).
 */
export function serializeContact(
  contact: Contact,
  computed?: { totalCredit: number; totalDebit: number; lastSeen: Date | null }
) {
  return {
    id: contact.id,
    name: contact.name,
    category: contact.category,
    piWalletAddress: contact.piWalletAddress,
    userId: contact.userId,
    totalCredit: computed?.totalCredit ?? 0,
    totalDebit: computed?.totalDebit ?? 0,
    lastSeen: computed?.lastSeen ? computed.lastSeen.toISOString() : null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

/**
 * In-app payment intent, for its sender only. Never includes the receiver's user id
 * (or memberId/uid/username): the receiver is shown by wallet address only.
 */
export function serializePaymentIntent(intent: PaymentIntent) {
  return {
    id: intent.id,
    status: intent.status as "pending" | "confirmed" | "expired" | "cancelled",
    receiverAddress: intent.receiverAddress,
    amount: intent.amount === null ? null : Number(intent.amount.toString()),
    contactId: intent.contactId,
    createdAt: intent.createdAt.toISOString(),
    expiresAt: intent.expiresAt.toISOString(),
    confirmedAt: intent.confirmedAt ? intent.confirmedAt.toISOString() : null,
    txHash: intent.txHash,
  };
}

/**
 * One Dashboard History row (a confirmed in-app payment) from the viewer's side. The
 * counterparty is the other side's wallet address plus the viewer's own contact for it;
 * name null means the viewer has no such contact ("Unidentified wallet address").
 */
export function serializeHistoryItem(
  intent: PaymentIntent,
  direction: "sent" | "received",
  counterpartyAddress: string,
  contact: { id: string; name: string } | null
) {
  return {
    id: intent.id,
    direction,
    amount: intent.amount === null ? 0 : Number(intent.amount.toString()),
    confirmedAt: (intent.confirmedAt ?? intent.createdAt).toISOString(),
    txHash: intent.txHash,
    counterparty: {
      walletAddress: counterpartyAddress,
      contactId: contact?.id ?? null,
      name: contact?.name ?? null,
    },
  };
}
