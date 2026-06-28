import { BookOpen } from "lucide-react";

interface BookkeepingLogoProps {
  compact?: boolean;
}

export function BookkeepingLogo({ compact = false }: BookkeepingLogoProps) {
  if (compact) {
    return (
      <div className="w-8 h-8 rounded-full bg-white dark:bg-card border-2 border-red-600 dark:border-[#8A2BE2] flex items-center justify-center shadow-sm flex-shrink-0">
        <BookOpen className="w-4 h-4 text-red-600 dark:text-[#8A2BE2]" />
      </div>
    );
  }
  return (
    <div className="w-20 h-20 rounded-full bg-white dark:bg-card border-4 border-red-600 dark:border-[#8A2BE2] flex items-center justify-center shadow-lg">
      <BookOpen className="w-10 h-10 text-red-600 dark:text-[#8A2BE2]" />
    </div>
  );
}
