-- In-app payments whose transaction failed on the Pi blockchain get status 'failed'.
-- Constraint-only change (no schema.prisma model change: status is a String).
ALTER TABLE "PaymentIntent" DROP CONSTRAINT "PaymentIntent_status_check";
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_status_check"
  CHECK ("status" IN ('pending', 'confirmed', 'failed', 'expired', 'cancelled'));
