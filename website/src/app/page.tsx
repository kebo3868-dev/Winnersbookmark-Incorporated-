import Link from 'next/link';
import { agents } from '@/data/agents';
import { pricing } from '@/data/pricing';
import { company } from '@/data/site';
import { StatusBadge } from '@/components/StatusBadge';

const leaks = [
  ['01', 'The unanswered call', 'A guest calls during the rush. The team is busy. No one knows what the caller needed.', 'cyan'],
  ['02', 'The broken path', 'A menu, reservation, or order link adds friction right when someone is ready to act.', 'violet'],
  ['03', 'The forgotten inquiry', 'Catering and event requests arrive in different places without a reliable next step.', 'coral'],
  ['04', 'The missing follow-up', 'A useful conversation ends, but the customer never hears from the business again.', 'lime'],
] as const;

const process = [
  ['Investigate', 'Map the customer journey and the systems behind it.'],
  ['Verify', 'Record what we can observe; label what needs internal data.'],
  ['Prioritize', 'Choose the friction worth fixing first.'],
  ['Build', 'Configure the simplest practical workflow for the business.'],
  ['Measure', 'Review response, capture, and handoff performance.'],
] as const;

export default function HomePage() {
  const featuredSystems = [agents[0], agents[1], agents[3], agents[2]];
  return <>
    <section className="wbi-hero">
      <div className="shell hero-grid">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="spark" /> AI SYSTEMS FOR THE REAL WORLD <span className="kicker-line" /></div>
          <h1>Smart systems.<br /><span>Real results.</span></h1>
          <p className="hero-summary">Find the gaps. Fix the friction. Build a business that responds when customers are ready.</p>
          <p className="hero-detail">{company.legalName} helps restaurants and local businesses investigate customer journeys, capture inquiries, and put practical AI workflows to work.</p>
          <div className="hero-actions">
            <Link className="btn-primary" href="/audit">Request an AI Business Audit <span aria-hidden="true">↗</span></Link>
            <Link className="btn-secondary" href="#systems">Explore our systems <span aria-hidden="true">↓</span></Link>
          </div>
          <p className="hero-footnote">Evidence first. Human oversight. No invented results.</p>
        </div>
        <div className="command-visual" role="img" aria-label="WBI system map connecting customer journey discovery, evidence, and customer communication">
          <div className="visual-header"><span className="visual-mark">W<span>BI</span></span><span>INTELLIGENCE / OPERATIONS</span><span className="visual-live">● SYSTEM MAP</span></div>
          <div className="visual-main">
            <div className="visual-timeline"><span>01 / DISCOVER</span><span>02 / RESPOND</span><span>03 / LEARN</span></div>
            <div className="visual-title">From signal to<br /><em>smarter action.</em></div>
            <div className="visual-map">
              <div className="map-node node-a"><small>PUBLIC JOURNEY</small><strong>Discover friction</strong><span>Restaurant Rescue</span></div>
              <div className="map-node node-b"><small>INTELLIGENCE</small><strong>Prioritize evidence</strong><span>GIGI</span></div>
              <div className="map-node node-c"><small>COMMUNICATION</small><strong>Capture the inquiry</strong><span>AI Front Desk</span></div>
            </div>
          </div>
          <div className="visual-bottom"><span>INVESTIGATE <b>→</b> VERIFY <b>→</b> BUILD</span><span>WBI / 2026</span></div>
        </div>
      </div>
      <div className="shell hero-strip"><span>RESTAURANT INTELLIGENCE</span><span>AI COMMUNICATION</span><span>WORKFLOW AUTOMATION</span><span>MEASURABLE OPERATIONS</span></div>
    </section>

    <section className="wbi-section" id="challenge"><div className="shell">
      <div className="section-intro"><div><p className="eyebrow">THE OPPORTUNITY</p><h2>Where business slips<br /><span className="muted-heading">through the cracks.</span></h2></div><p>Most customer experience problems are small in isolation. Together they create a journey full of missed moments. We make those moments visible.</p></div>
      <div className="leak-grid">{leaks.map(([n, title, detail, color]) => <article className={"leak-card accent-" + color} key={n}><span className="leak-index">{n} / CUSTOMER FRICTION</span><div className="leak-symbol" aria-hidden="true">{n === '01' ? '⌁' : n === '02' ? '↗' : n === '03' ? '◈' : '↻'}</div><h3>{title}</h3><p>{detail}</p></article>)}</div>
      <Link className="text-link" href="/diagnostic">Explore your opportunity profile <span aria-hidden="true">↗</span></Link>
    </div></section>

    <section className="wbi-section systems-section" id="systems"><div className="shell">
      <div className="section-intro"><div><p className="eyebrow">THE WBI ECOSYSTEM</p><h2>One problem at a time.<br /><span className="muted-heading">One connected strategy.</span></h2></div><p>Each system has a specific job. Availability is shown openly, so you can distinguish today’s offers from what is still being developed.</p></div>
      <div className="systems-grid">{featuredSystems.map((agent, index) => <article className={"system-card system-" + index} key={agent.slug}><div className="system-card-top"><span className="system-number">SYSTEM / 0{index + 1}</span><StatusBadge status={agent.status} /></div><div className="system-glyph" aria-hidden="true">{['◎','✳','↗','◉'][index]}</div><h3>{agent.name === 'Gigi' ? 'GIGI' : agent.name}</h3><p>{agent.tagline}</p><Link href={"/solutions/" + agent.slug} className="system-link">Explore system <span aria-hidden="true">↗</span></Link></article>)}<article className="system-card system-4"><div className="system-card-top"><span className="system-number">SERVICE / 05</span><span className="text-xs font-semibold text-emerald-300">Available by consultation</span></div><div className="system-glyph" aria-hidden="true">⟲</div><h3>Automation Systems</h3><p>Design follow-up and handoff workflows around the tools your business already uses.</p><Link href="/consulting" className="system-link">Explore service ↗</Link></article><article className="system-card system-5"><div className="system-card-top"><span className="system-number">SERVICE / 06</span><span className="text-xs font-semibold text-emerald-300">Available by request</span></div><div className="system-glyph" aria-hidden="true">⌕</div><h3>AI Business Audits</h3><p>Find customer journey friction and decide which changes deserve attention first.</p><Link href="/audit" className="system-link">Explore audit ↗</Link></article></div>
      <div className="ecosystem-note"><div><span className="note-tag">HOW THEY CONNECT</span><strong>Discover <span>→</span> diagnose <span>→</span> respond <span>→</span> measure</strong></div><p>GIGI investigates opportunities. Restaurant Rescue examines the public journey. AI Front Desk supports customer communication. WBI reviews what the workflow actually does.</p></div>
    </div></section>

    <section className="wbi-section method-section"><div className="shell"><div className="section-intro"><div><p className="eyebrow">OUR METHOD</p><h2>Clarity before<br /><span className="muted-heading">complexity.</span></h2></div><p>Every engagement starts with the business problem. Technology follows the evidence.</p></div><ol className="method-grid">{process.map(([title, detail], i) => <li key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{detail}</p></li>)}</ol></div></section>

    <section className="wbi-section diagnostic-band"><div className="shell diagnostic-inner"><div><p className="eyebrow">START WITH A SIGNAL CHECK</p><h2>Where should your business<br />look first?</h2><p>Answer ten practical questions. Get an on-screen opportunity profile and a sensible next step. No revenue guesswork.</p><Link href="/diagnostic" className="btn-primary">Start the free diagnostic <span aria-hidden="true">↗</span></Link></div><div className="diagnostic-preview" aria-hidden="true"><span>WBI / OPPORTUNITY PROFILE</span><div><b>COMMUNICATION</b><i /><i /><i /></div><div><b>DIGITAL FRICTION</b><i /><i /></div><div><b>FOLLOW-UP</b><i /><i /><i /><i /></div><small>Answers are assessed on your device.</small></div></div></section>

    <section className="wbi-section" id="engage"><div className="shell"><div className="section-intro"><div><p className="eyebrow">ENGAGEMENT OPTIONS</p><h2>A practical place<br /><span className="muted-heading">to begin.</span></h2></div><p>Start with a focused audit or discuss a pilot. Scope and integrations are confirmed before work begins.</p></div><div className="price-grid">{pricing.map(item => <article className="price-card" key={item.name}><div><span>{item.type}</span><h3>{item.name}</h3><p>{item.description}</p></div><div><strong>{item.display}</strong><small>{item.note}</small><Link href={"/contact?interest=" + item.interest} className="price-link">Discuss this option ↗</Link></div></article>)}</div><p className="pricing-footnote">Prices are starting points. Final scope depends on locations, usage, workflows, and integrations. A proposal defines deliverables before any commitment.</p></div></section>

    <section className="wbi-section founder-section"><div className="shell founder-grid"><div><p className="eyebrow">BUILT BY KEITH WARREN</p><h2>Technology should<br />earn its place.</h2></div><div><p>“Businesses do not need another AI promise. They need a clear view of the problem and a system people can actually use.”</p><span>KEITH WARREN · FOUNDER, WBI</span><Link href="/about" className="text-link">Meet the company ↗</Link></div></div></section>
    <section className="wbi-section final-section"><div className="shell"><div className="final-panel"><p className="eyebrow">LET'S GET SPECIFIC</p><h2>Find the friction.<br /><span>Build the fix.</span></h2><p>Tell us what customers are trying to do and where the process gets stuck. We’ll suggest a sensible first step.</p><Link href="/audit" className="btn-primary">Request an AI Business Audit ↗</Link></div></div></section>
  </>;
}
