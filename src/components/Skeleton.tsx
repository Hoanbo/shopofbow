interface Props {
  count?: number;
  /** matches the card shape used in each section */
  variant?: 'tool' | 'app' | 'product';
  className?: string;
}

const shapes: Record<NonNullable<Props['variant']>, string> = {
  tool: 'h-40',
  app: 'h-24',
  product: 'aspect-[4/3]',
};

/** Lightweight loading placeholder that mirrors card dimensions. */
export default function Skeleton({ count = 6, variant = 'product', className = '' }: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse rounded-card border border-brand-100 bg-white ${shapes[variant]} ${className}`}
        >
          <div className="h-full w-full rounded-card bg-brand-50/60" />
        </div>
      ))}
    </>
  );
}
