"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { MobileMenu } from "./MobileMenu";
import { navLinks } from "./nav";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-gold-500/15 bg-ink-950/90 backdrop-blur-xl"
          : "bg-gradient-to-b from-ink-950/80 to-transparent"
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-8 px-5 lg:px-8">
        <Link href="/" className="group flex flex-col leading-none">
          <span className="font-display text-lg font-semibold tracking-wide text-cream-50 transition-colors group-hover:text-gold-300">
            Winnersbookmark
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-luxe text-gold-500">
            Daily Blogs
          </span>
        </Link>

        <nav className="hidden items-center gap-6 xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.16em] transition-colors",
                pathname === link.href
                  ? "text-gold-400"
                  : "text-cream-200/70 hover:text-cream-50"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button href="/membership" size="sm" className="hidden sm:inline-flex">
            Start 7-Day Free Trial
          </Button>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-cream-50/10 text-cream-100 transition-colors hover:border-gold-500/40 hover:text-gold-300 xl:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
