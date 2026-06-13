import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Fantasy">
      <span className="brand-mark"><i /><i /><i /></span>
      {!compact && <span><strong>FANTASY</strong></span>}
    </Link>
  );
}
