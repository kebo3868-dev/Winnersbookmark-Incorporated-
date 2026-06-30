import { useState } from 'react';
import { Mail, Send, Check, MessageSquare } from 'lucide-react';
import Layout from '../components/Layout';
import { useMeta } from '../lib/useMeta';
import { site } from '../data/site';

export default function Contact() {
  useMeta(
    'Contact',
    'Get in touch with the Winners Bookmark team — questions, partnerships, or feedback.'
  );

  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const onSubmit = (e) => {
    e.preventDefault();
    // Front-end prototype: wire this to your email service or backend later.
    setSent(true);
  };

  return (
    <Layout>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-14 items-start">
          <div>
            <div className="eyebrow mb-3">Contact</div>
            <h1 className="hero-title text-paper">Let’s Talk</h1>
            <p className="mt-4 text-mist leading-relaxed">
              Questions about membership, ideas for content, partnership inquiries, or just want to
              say the work is hitting? Send a message — we read everything.
            </p>

            <div className="mt-8 grid gap-3">
              <a
                href={`mailto:${site.email}`}
                className="glass card-pad flex items-center gap-3 hover:border-gold/40 transition-colors"
              >
                <span className="icon-btn !w-10 !h-10 text-gold-light"><Mail size={18} /></span>
                <div>
                  <div className="text-xs text-ghost">Email us</div>
                  <div className="text-sm text-paper font-medium">{site.email}</div>
                </div>
              </a>
              <div className="glass card-pad flex items-center gap-3">
                <span className="icon-btn !w-10 !h-10 text-electric-glow"><MessageSquare size={18} /></span>
                <div>
                  <div className="text-xs text-ghost">Follow the brand</div>
                  <div className="flex gap-3 text-sm text-chalk mt-0.5">
                    <a href={site.social.x} className="hover:text-gold-light">X</a>
                    <a href={site.social.instagram} className="hover:text-gold-light">Instagram</a>
                    <a href={site.social.youtube} className="hover:text-gold-light">YouTube</a>
                    <a href={site.social.tiktok} className="hover:text-gold-light">TikTok</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-strong card-pad-lg sm:p-8">
            {sent ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-success/40 bg-success/10 text-success mb-4">
                  <Check size={26} />
                </div>
                <h2 className="font-display text-2xl font-bold text-paper">Message sent</h2>
                <p className="mt-2 text-mist text-sm">
                  Thanks, {form.name || 'friend'}. We’ll get back to you soon.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-4">
                <div className="field">
                  <label className="label">Your name</label>
                  <input type="text" required value={form.name} onChange={update('name')} placeholder="John Carter" />
                </div>
                <div className="field">
                  <label className="label">Email address</label>
                  <input type="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" />
                </div>
                <div className="field">
                  <label className="label">Message</label>
                  <textarea required value={form.message} onChange={update('message')} placeholder="What’s on your mind?" rows={5} />
                </div>
                <button type="submit" className="btn-gold w-full mt-1">
                  <Send size={16} /> Send Message
                </button>
                <p className="text-xs text-ghost text-center">
                  This is a front-end prototype form — connect it to your email service to go live.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
