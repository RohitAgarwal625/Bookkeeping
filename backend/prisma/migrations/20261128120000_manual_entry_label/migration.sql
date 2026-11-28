-- Rename the default label of manual entries saved without a note:
-- "Manual Debit Entry" -> "Manual Entry: Debit", "Manual Credit Entry" -> "Manual Entry: Credit".
-- Data-only change (no schema.prisma change).
UPDATE "Transaction" SET "description" = 'Manual Entry: Debit' WHERE "description" = 'Manual Debit Entry';
UPDATE "Transaction" SET "description" = 'Manual Entry: Credit' WHERE "description" = 'Manual Credit Entry';
