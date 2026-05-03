import { BookOpen } from "lucide-react";

export function BookkeepingLogo() {
  return (
    <div className="w-20 h-20 rounded-full bg-white dark:bg-card border-4 border-red-600 dark:border-[#8A2BE2] flex items-center justify-center shadow-lg">
      <BookOpen className="w-10 h-10 text-red-600 dark:text-[#8A2BE2]" />
    </div>
  );
}
