import logo from "../assets/favicon.svg";

interface BookkeepingLogoProps {
  compact?: boolean;
}

export function BookkeepingLogo({ compact = false }: BookkeepingLogoProps) {
  return (
    <img
      src={logo}
      alt="Bookkeeping"
      className={compact ? "w-8 h-8 object-contain flex-shrink-0" : "w-20 h-20 object-contain drop-shadow-md"}
    />
  );
}
