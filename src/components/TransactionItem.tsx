import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface Transaction {
  id: string;
  customerName: string;
  type: "credit" | "debit";
  amount: string;
  date: string;
}

interface TransactionItemProps {
  transaction: Transaction;
  isLast: boolean;
  onClick?: (customerName: string) => void;
}

export function TransactionItem({ transaction, isLast, onClick }: TransactionItemProps) {
  const isCredit = transaction.type === "credit";

  return (
    <div 
      className={`p-4 flex items-center justify-between ${!isLast ? 'border-b border-gray-100 dark:border-border' : ''} ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary transition-colors' : ''}`}
      onClick={() => onClick?.(transaction.customerName)}
    >
      <div className="flex items-center gap-3">
        {/* Icon Badge */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isCredit ? 'bg-green-100 dark:bg-green-950/30' : 'bg-red-100 dark:bg-red-950/30'
          }`}
        >
          {isCredit ? (
            <ArrowDownLeft className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
        </div>

        {/* Customer Info */}
        <div>
          <p className="text-gray-900 dark:text-foreground text-sm">{transaction.customerName}</p>
          <p className="text-gray-500 dark:text-muted-foreground text-xs">{transaction.date}</p>
        </div>
      </div>

      {/* Amount and Badge */}
      <div className="flex flex-col items-end gap-1">
        <p className={`font-bold ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          π {transaction.amount}
        </p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            isCredit
              ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
          }`}
        >
          {isCredit ? 'Credit' : 'Debit'}
        </span>
      </div>
    </div>
  );
}