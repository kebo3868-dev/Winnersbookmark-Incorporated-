import { CreditCard, ShoppingBag } from 'lucide-react';
import { site } from '../data/site';

// Renders the Gumroad + Stripe checkout entry points. Swap the URLs in
// src/data/site.js (site.checkout) for your live links.
export default function CheckoutButtons({ stacked = false }) {
  return (
    <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-2'}`}>
      <a
        href={site.checkout.stripe}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary w-full"
      >
        <CreditCard size={17} />
        Subscribe with Stripe
      </a>
      <a
        href={site.checkout.gumroad}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-gold w-full"
      >
        <ShoppingBag size={17} />
        Join via Gumroad
      </a>
    </div>
  );
}
