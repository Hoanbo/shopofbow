interface AppLogoProps {
  slug?: string;
  name?: string;
  image?: string;
  className?: string;
}

export default function AppLogo({ name = '', image = '', className = 'h-[64px] w-[64px]' }: AppLogoProps) {
  const imgSrc = image || '/assets/logos/bowLogo.jpeg';
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900 p-0.5 sm:p-1 border border-slate-100/80 dark:border-slate-800/80 shadow-xs ${className}`}>
      <img
        src={imgSrc}
        alt={name}
        className="h-full w-full object-cover rounded-lg sm:rounded-xl"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/assets/logos/bowLogo.jpeg';
        }}
      />
    </div>
  );
}
