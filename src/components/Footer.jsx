import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-ink-line bg-ink-black/60 mt-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <div className="leading-tight">
            <div className="font-display font-semibold text-paper text-sm">Winnersbookmark CineComic Studio</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-mist">Designed by Winnersbookmark Incorporated</div>
          </div>
        </div>
        <div className="text-[11px] text-ghost">
          Build the story. Design the world. Generate the panels. Publish the legend.
        </div>
      </div>
    </footer>
  );
}
