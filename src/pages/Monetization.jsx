import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import { DollarSign, FileDown, BookOpen, ShoppingBag, Users, Youtube, Mail, Newspaper, Briefcase, LayoutTemplate } from 'lucide-react';

const PLAYS = [
  { icon: FileDown,      title: 'Sell a digital PDF',          desc: 'Lock the final PDF behind a paywall on Gumroad, Payhip, or Ko-fi.', est: '$5–$15' },
  { icon: BookOpen,      title: 'Publish on Kindle / KDP',     desc: 'Upload as a comic — Amazon’s KDP supports fixed-layout PDF.', est: '$2.99–$9.99' },
  { icon: ShoppingBag,   title: 'Sell on Gumroad',             desc: 'Charge per issue. Bundle 3 issues for 25% off.', est: '$3–$12 per issue' },
  { icon: Users,         title: 'Patreon weekly episodes',     desc: 'Drip-feed one page or panel per week to tier subscribers.', est: '$3–$15/mo per fan' },
  { icon: Youtube,       title: 'YouTube Shorts / TikTok',     desc: 'Animate the panels with Runway/Pika. Drive to your sales link.', est: 'Free reach' },
  { icon: ShoppingBag,   title: 'Sell character merch',        desc: 'Print on demand: shirts, posters, stickers via Printful or Redbubble.', est: '$15–$45 AOV' },
  { icon: Mail,          title: 'Build an email list',         desc: 'Capture readers with a free preview chapter.', est: 'Compounding' },
  { icon: Newspaper,     title: 'Comic newsletter',            desc: 'Weekly recap + sneak peeks via Substack or Beehiiv.', est: 'Paid tiers' },
  { icon: Briefcase,     title: 'Pitch to publishers',         desc: 'Send a 5-page sample + script PDF to Image, BOOM!, Oni, indies.', est: 'Variable' },
  { icon: LayoutTemplate,title: 'Sell paid templates',         desc: 'License your storyboard / cover template to other creators.', est: '$10–$50 per template' },
];

export default function Monetization() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Monetization"
          title="Turn the comic into income"
          subtitle="Ten plays a working comic creator runs. Mix and stack as your audience grows."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLAYS.map(p => (
            <div key={p.title} className="glass card-pad">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 text-gold-light flex items-center justify-center shrink-0">
                  <p.icon size={16}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-paper">{p.title}</div>
                  <p className="text-mist text-xs mt-0.5">{p.desc}</p>
                </div>
                <span className="chip-gold shrink-0">{p.est}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="glass card-pad-lg accent-top mt-6">
          <div className="eyebrow mb-2 flex items-center gap-2"><DollarSign size={12}/> First sale playbook</div>
          <ol className="text-sm text-chalk space-y-2 list-decimal list-inside marker:text-gold">
            <li>Finish the cover and the first 3 pages. That’s your free preview.</li>
            <li>Open a Gumroad page. Title = comic name. Price = $5 launch.</li>
            <li>Run a 7-day countdown on TikTok / Shorts using the panels.</li>
            <li>Email anyone who opted into the free preview with the launch link.</li>
            <li>Reinvest first $100 into ads or merch test for the strongest character.</li>
          </ol>
          <p className="text-xs text-mist mt-3">Project: <span className="text-paper">"{project.title}"</span> — your first issue is your first product. Treat it that way.</p>
        </div>
      </div>
    </Layout>
  );
}
