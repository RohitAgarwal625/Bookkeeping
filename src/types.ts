export interface Contact {
  id: string;
  name: string;
  category: "individual" | "business";
  piWalletAddress: string;
  txHash: string;
  lastSeen: string;
  totalCredit: number;
  totalDebit: number;
}

export const initialContacts: Contact[] = [
  {
    id: "1",
    name: "Ananya Reddy",
    category: "individual",
    piWalletAddress: "0x8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e",
    txHash: "0x321fed654cba987fed654cba987fed654cba987fe",
    lastSeen: "Feb 15, 2026",
    totalCredit: 680.50,
    totalDebit: 0,
  },
  {
    id: "2",
    name: "Amit Patel",
    category: "business",
    piWalletAddress: "0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    txHash: "0x123abc456def789abc123def456789abc123def456",
    lastSeen: "Feb 18, 2026",
    totalCredit: 1875.00,
    totalDebit: 0,
  },
  {
    id: "3",
    name: "Priya Sharma",
    category: "individual",
    piWalletAddress: "0x9f8e7d6c5b4a3e2d1c0b9a8f7e6d5c4b3a2e1d0c",
    txHash: "0xdef789abc123def456789abc123def456789abc123",
    lastSeen: "Feb 19, 2026",
    totalCredit: 450.00,
    totalDebit: 730.50,
  },
  {
    id: "4",
    name: "Rajesh Kumar",
    category: "business",
    piWalletAddress: "0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e",
    txHash: "0xabc123def456789abc123def456789abc123def456789",
    lastSeen: "Feb 20, 2026",
    totalCredit: 1350.00,
    totalDebit: 200.00,
  },
  {
    id: "5",
    name: "Sneha Gupta",
    category: "individual",
    piWalletAddress: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
    txHash: "0x789def123abc456def789abc123def456789abc123",
    lastSeen: "Feb 17, 2026",
    totalCredit: 320.00,
    totalDebit: 515.75,
  },
  {
    id: "6",
    name: "Vikram Singh",
    category: "business",
    piWalletAddress: "0x2f3c4b5a6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
    txHash: "0x456def789abc123def456789abc123def456789abc",
    lastSeen: "Feb 16, 2026",
    totalCredit: 1200.00,
    totalDebit: 150.00,
  },
];
