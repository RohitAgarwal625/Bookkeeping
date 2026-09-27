import type { Contact, Transaction, User } from "@prisma/client";

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
