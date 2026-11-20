-- AUD-71: defence-in-depth CHECK constraints (hand-written; Prisma's schema can't express CHECK).
-- NOT VALID: enforced for every new INSERT/UPDATE immediately, but existing rows are not scanned,
-- so the deploy cannot fail on old production data. Run the pre-check, then VALIDATE separately.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_positive" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_type_check" CHECK ("type" IN ('credit', 'debit')) NOT VALID;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_source_check" CHECK ("source" IN ('manual', 'pi_network')) NOT VALID;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_status_check" CHECK ("status" IN ('pending', 'completed', 'failed', 'cancelled', 'expired')) NOT VALID;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_category_check" CHECK ("category" IN ('individual', 'business')) NOT VALID;
