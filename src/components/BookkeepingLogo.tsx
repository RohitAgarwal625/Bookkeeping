import logo from "../assets/favicon.svg";

interface BookkeepingLogoProps {
  compact?: boolean;
  large?: boolean;
}

export function BookkeepingLogo({ compact = false, large = false }: BookkeepingLogoProps) {
  if (large) {
    return (
      <img
        src={logo}
        alt="Bookkeeping"
        className="w-full aspect-square max-w-[280px] object-contain drop-shadow-xl"
      />
    );
  }
  return (
    <img
      src={logo}
      alt="Bookkeeping"
      className={compact ? "w-10 h-10 relative left-3 object-contain flex-shrink-0" : "w-20 h-20 object-contain drop-shadow-md"}
    />
  );
}
