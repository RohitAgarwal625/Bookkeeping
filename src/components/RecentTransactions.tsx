import { TransactionItem } from "./TransactionItem";

const mockTransactions: Array<{
  id: string;
  customerName: string;
  type: "debit" | "credit";
  amount: string;
  date: string;
}> = [];

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