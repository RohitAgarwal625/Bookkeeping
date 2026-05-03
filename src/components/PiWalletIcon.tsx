export function PiWalletIcon() {
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="walletGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#A47CF3', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#F7C548', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        
        {/* Wallet shape */}
        <rect x="16" y="32" width="96" height="72" rx="8" fill="url(#walletGradient)" opacity="0.9"/>
        
        {/* Wallet flap */}
        <path d="M 16 32 L 16 48 L 64 48 L 80 32 Z" fill="url(#walletGradient)" opacity="0.7"/>
        
        {/* Card slot detail */}
        <rect x="28" y="52" width="48" height="4" rx="2" fill="white" opacity="0.4"/>
        
        {/* Pi symbol simplified */}
        <circle cx="64" cy="74" r="18" fill="white" opacity="0.9"/>
        <text x="64" y="82" textAnchor="middle" fill="#A47CF3" fontSize="20" fontWeight="bold">π</text>
      </svg>
    </div>
  );
}
