interface BalanceCardProps {
  piBalance: string;
}

export function BalanceCard({ piBalance }: BalanceCardProps) {
  return (
    <div className="bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border dark:border-border p-6 mb-6">
      {/* Total Balance */}
      {/* <div className="text-center mb-6">
        <p className="text-gray-500 dark:text-muted-foreground text-sm mb-2">Total Balance</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-bold bg-gradient-to-r from-[#A47CF3] to-[#F7C548] bg-clip-text text-transparent">
            π {piBalance}
          </span>
        </div>
      </div> */}

      {/* Credit/Debit Summary */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Debit */}
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200 dark:border-red-800/40">
          <p className="text-red-700 dark:text-red-400 text-xs mb-1">Total Debit</p>
          <p className="text-red-800 dark:text-red-300 font-bold text-lg">π 875.30</p>
        </div>

        {/* Total Credit */}
        <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 border border-green-200 dark:border-green-800/40">
          <p className="text-green-700 dark:text-green-400 text-xs mb-1">Total Credit</p>
          <p className="text-green-800 dark:text-green-300 font-bold text-lg">π 1,245.50</p>
        </div>
      </div>
    </div>
  );
}