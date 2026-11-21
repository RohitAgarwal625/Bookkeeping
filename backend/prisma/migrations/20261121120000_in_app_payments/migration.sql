-- In-app payments (Pay via contacts / Pay via QR) and the internal member id.
-- Generated with `prisma migrate diff` (migrate dev refuses to run non-interactively when it
-- warns about the new unique indexes); the memberId part is hand-written so existing users
-- are numbered in createdAt order, and the CHECK constraints at the end are hand-written
-- (Prisma can't express CHECK).

-- MemberId: "BK" + the sequence number zero-padded to at least 4 digits (BK0001 .. BK9999, BK10000, ...).
CREATE SEQUENCE "User_memberId_seq" AS BIGINT START WITH 1;

CREATE FUNCTION bk_format_member_id(n BIGINT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE STRICT
  AS $$ SELECT 'BK' || lpad(n::text, GREATEST(4, length(n::text)), '0') $$;

CREATE FUNCTION bk_next_member_id() RETURNS TEXT
  LANGUAGE sql VOLATILE
  AS $$ SELECT bk_format_member_id(nextval('"User_memberId_seq"')) $$;

-- AlterTable (nullable first, so the backfill below decides the order, not the table's physical order)
ALTER TABLE "User" ADD COLUMN "memberId" TEXT;

-- backfill:start (existing users numbered 1..n by createdAt, ties by id)
UPDATE "User" u
SET "memberId" = bk_format_member_id(o.n)
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS n FROM "User") o
WHERE u.id = o.id;
-- backfill:end

-- The next new user gets the number after the last backfilled one (1 when there are no users).
SELECT setval('"User_memberId_seq"', COALESCE((SELECT count(*) FROM "User"), 0) + 1, false);

ALTER TABLE "User" ALTER COLUMN "memberId" SET DEFAULT bk_next_member_id();
ALTER TABLE "User" ALTER COLUMN "memberId" SET NOT NULL;
ALTER SEQUENCE "User_memberId_seq" OWNED BY "User"."memberId";

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "amount" DECIMAL(18,7),
    "contactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "chainPaymentId" TEXT,
    "txHash" TEXT,
    "senderTransactionId" TEXT,
    "receiverTransactionId" TEXT,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_chainPaymentId_key" ON "PaymentIntent"("chainPaymentId");

-- CreateIndex
CREATE INDEX "PaymentIntent_senderId_status_idx" ON "PaymentIntent"("senderId", "status");

-- CreateIndex
CREATE INDEX "PaymentIntent_receiverId_status_idx" ON "PaymentIntent"("receiverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- CreateIndex (production checked before: 0 duplicate walletPublicKey values)
CREATE UNIQUE INDEX "User_walletPublicKey_key" ON "User"("walletPublicKey");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints (hand-written; new table, so no NOT VALID needed)
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_status_check"
  CHECK ("status" IN ('pending', 'confirmed', 'expired', 'cancelled'));
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_amount_check"
  CHECK ("amount" IS NULL OR "amount" > 0);
