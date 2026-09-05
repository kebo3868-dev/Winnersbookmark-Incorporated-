import Link from 'next/link';
import { primaryNav } from '@/data/site';

export default function NotFound() {
  return (
    <div className="shell flex min-h-[60vh] flex-col justify-center py-20">
      <div className="max-w-xl">
        <p className="eyebrow">404</p>
        <h1 className="mt-4 text-display-lg font-bold text-snow">This page does not exist.</h1>
        <p className="lede mt-5">
          The link may be out of date, or the page may have moved. Here is where to go instead.
        </p>

        <ul className="mt-9 flex flex-wrap gap-2.5">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-block rounded-lg border border-night-line bg-night-card px-4 py-2.5 text-sm text-snow-dim transition-colors hover:border-night-edge hover:text-white"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">Back to the homepage</Link>
          <Link href="/contact" className="btn-secondary">Contact us</Link>
        </div>
      </div>
    </div>
  );
}
