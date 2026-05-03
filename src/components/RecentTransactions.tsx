import { TransactionItem } from "./TransactionItem";

const mockTransactions = [
  {
    id: "1",
    customerName: "Rajesh Kumar",
    type: "credit" as const,
    amount: "450.00",
    date: "Today, 2:30 PM",
  },
  {
    id: "2",
    customerName: "Priya Sharma",
    type: "debit" as const,
    amount: "280.50",
    date: "Today, 11:15 AM",
  },
  {
    id: "3",
    customerName: "Amit Patel",
    type: "credit" as const,
    amount: "625.00",
    date: "Yesterday, 5:45 PM",
  },
  {
    id: "4",
    customerName: "Sneha Gupta",
    type: "debit" as const,
    amount: "195.75",
    date: "Yesterday, 3:20 PM",
  },
];

interface RecentTransactionsProps {
  onCustomerClick?: (customerName: string) => void;
}

export function RecentTransactions({ onCustomerClick }: RecentTransactionsProps) {
  return (
    <div>
      <h3 className="text-gray-900 dark:text-foreground mb-4">Recent Entries</h3>
      <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border overflow-hidden">
        {mockTransactions.map((transaction, index) => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            isLast={index === mockTransactions.length - 1}
            onClick={onCustomerClick}
          />
        ))}
      </div>
    </div>
  );
}