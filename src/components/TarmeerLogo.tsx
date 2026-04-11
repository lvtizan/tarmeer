import { Link } from 'react-router-dom';

interface TarmeerLogoProps {
  to?: string;
  className?: string;
}

export default function TarmeerLogo({ to = '/', className = '' }: TarmeerLogoProps) {
  return (
    <Link to={to} className={`flex items-center gap-2 font-serif text-xl sm:text-2xl font-bold text-[#2c2c2c] ${className}`}>
      <img
        src="/images/tarmeer_logo.svg"
        alt=""
        className="h-8 sm:h-9 w-auto"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      TARMEER
    </Link>
  );
}
