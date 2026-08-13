interface AppLogoProps {
  slug?: string;
  name?: string;
  image?: string;
  className?: string;
}

export default function AppLogo({ name = '', image = '', className = 'h-16 w-16 sm:h-[80px] sm:w-[80px]' }: AppLogoProps) {
  const imgSrc = image || '/assets/logos/bowLogo.jpeg';
  return (
    <div
      className={`relative flex aspect-square items-center justify-center shrink-0 overflow-hidden rounded-2xl sm:rounded-[22px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-md shadow-slate-200/40 dark:shadow-none ${className}`}
    >
      <img
        src={imgSrc}
        alt={name}
        className="h-full w-full object-cover object-center rounded-2xl transition-transform duration-300"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/assets/logos/bowLogo.jpeg';
        }}
      />
    </div>
  );
}

