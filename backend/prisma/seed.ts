import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

/**
 * Seed script — creates a demo user with contacts and transactions
 * for local development. Mirrors the frontend's old `initialContacts`.
 */
async function main() {
  const demoWallet = "0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e";

  const user = await prisma.user.upsert({
    where: { piWalletAddress: demoWallet },
    update: {},
    create: {
      piWalletAddress: demoWallet,
      displayName: "Pioneer User",
    },
  });

  const contactsData = [
    { name: "Chengdiao Fan", wallet: "0x8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e", credit: 680.5, debit: 0 },
    { name: "Nicolas Kokkalis", wallet: "0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d", credit: 1875, debit: 0 },
    { name: "Pavel Durov", wallet: "0x9f8e7d6c5b4a3e2d1c0b9a8f7e6d5c4b3a2e1d0c", credit: 450, debit: 730.5 },
    { name: "Satoshi Nakamoto", wallet: "0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e", credit: 1350, debit: 200 },
    { name: "Vitalik Buterin", wallet: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f", credit: 320, debit: 515.75 },
  ];

  for (const c of contactsData) {
    const contact = await prisma.contact.upsert({
      where: { userId_piWalletAddress: { userId: user.id, piWalletAddress: c.wallet } },
      update: {},
      create: {
        name: c.name,
        category: "individual",
        piWalletAddress: c.wallet,
        userId: user.id,
      },
    });

    if (c.credit > 0) {
      await prisma.transaction.create({
        data: {
          description: `Received from ${c.name}`,
          amount: new Prisma.Decimal(c.credit),
          type: "credit",
          source: "manual",
          status: "completed",
          idempotencyKey: randomUUID(),
          userId: user.id,
          contactId: contact.id,
        },
      });
    }
    if (c.debit > 0) {
      await prisma.transaction.create({
        data: {
          description: `Paid to ${c.name}`,
          amount: new Prisma.Decimal(c.debit),
          type: "debit",
          source: "manual",
          status: "completed",
          idempotencyKey: randomUUID(),
          userId: user.id,
          contactId: contact.id,
        },
      });
    }
  }

  console.log(`✅ Seeded user ${user.id} with ${contactsData.length} contacts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
