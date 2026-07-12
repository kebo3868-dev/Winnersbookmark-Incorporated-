"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { navLinks } from "./nav";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-opacity duration-300 xl:hidden",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col border-l border-gold-500/15 bg-ink-900 shadow-luxe transition-transform duration-500",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-cream-50/[0.06] px-6 py-5">
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-semibold text-cream-50">
              Winnersbookmark
            </span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-luxe text-gold-500">
              Daily Blogs
            </span>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-cream-50/10 text-cream-100 hover:border-gold-500/40 hover:text-gold-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 py-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="border-b border-cream-50/[0.04] py-4 text-sm font-medium uppercase tracking-[0.16em] text-cream-200/80 transition-colors hover:text-gold-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-cream-50/[0.06] px-6 py-6">
          <Button href="/membership" className="w-full">
            Start 7-Day Free Trial
          </Button>
          <p className="mt-4 text-center text-[10px] uppercase tracking-luxe text-cream-300/40">
            Daily Discipline. Strategic Growth.
          </p>
        </div>
      </div>
    </div>
  );
}
