import Link from "next/link";
import { navLinks } from "./nav";

const secondaryLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Login", href: "/login" },
  { label: "Monthly Rotation", href: "/monthly-rotation" },
  { label: "Nutrition", href: "/nutrition" },
  { label: "AI Productivity", href: "/ai-productivity" },
  { label: "Admin", href: "/admin" },
];

export function Footer() {
  return (
    <footer className="border-t border-gold-500/15 bg-ink-950">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl font-semibold text-cream-50">
              Winnersbookmark{" "}
              <span className="text-gold-400">Daily Blogs</span>
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream-300/60">
              Daily Discipline. Strategic Growth. Built for Winners. New
              knowledge every day — new mentors, books, and standards every
              month.
            </p>
            <p className="mt-6 text-[10px] uppercase tracking-luxe text-cream-300/40">
              Keith Warren · Winners Bookmark Incorporated
            </p>
          </div>

          <div>
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-luxe text-gold-500">
              Platform
            </p>
            <ul className="space-y-3">
              {navLinks.slice(1).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-cream-300/60 transition-colors hover:text-gold-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-luxe text-gold-500">
              Company
            </p>
            <ul className="space-y-3">
              {secondaryLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-cream-300/60 transition-colors hover:text-gold-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center gap-3 border-t border-cream-50/[0.06] pt-8 text-center">
          <p className="text-xs text-cream-300/50">
            © {new Date().getFullYear()} Winners Bookmark Incorporated. All
            rights reserved.
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-luxe text-gold-500">
            Designed by Winnersbookmark Incorporated
          </p>
        </div>
      </div>
    </footer>
  );
}
