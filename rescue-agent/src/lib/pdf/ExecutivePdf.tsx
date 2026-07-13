import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { ExecutiveReportDTO, RevenueScenario } from '@/lib/reports/executive';

/**
 * Executive Audit Report PDF (Phase 2.5). Deterministic generation via
 * @react-pdf/renderer (pure-JS layout — no headless browser, Vercel-safe).
 * Standard PDF fonts (Times/Helvetica); nothing fetched at runtime. Obsidian
 * cover + dark section dividers for premium feel; ivory interior for print
 * readability. Illustrative scenarios are visually distinct and always carry a
 * "not a confirmed loss" qualifier.
 */

const C = {
  obsidian: '#0e0c09',
  espresso: '#221812',
  brown: '#2e2014',
  gold: '#b8924a',
  goldBright: '#d4ad5c',
  goldDim: '#8a6f33',
  ivory: '#f4efe6',
  paper: '#ffffff',
  ink: '#211c15',
  stone: '#6f6758',
  muted: '#6f6758',
  line: '#ddd5c5',
  softBg: '#f7f3ea',
  goldWash: '#faf5e9',
  green: '#3e6b4f',
  amber: '#8a6d2f',
  red: '#8a3b32',
};

const s = StyleSheet.create({
  cover: { backgroundColor: C.obsidian, color: C.ivory, paddingVertical: 52, paddingHorizontal: 56, justifyContent: 'space-between' },
  // No page-level lineHeight — react-pdf 4.x won't paint render-prop page
  // numbers when the Page style sets an inherited lineHeight.
  page: { backgroundColor: C.paper, color: C.ink, paddingTop: 52, paddingBottom: 64, paddingHorizontal: 52, fontFamily: 'Helvetica', fontSize: 9.5 },
  divider: { backgroundColor: C.obsidian, color: C.ivory, justifyContent: 'center', paddingHorizontal: 56 },
  h2: { fontFamily: 'Times-Bold', fontSize: 15, color: C.ink, marginBottom: 6 },
  sectionKicker: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 2, color: C.goldDim, textTransform: 'uppercase', marginBottom: 4 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.gold, marginBottom: 12, width: 42 },
  body: { fontSize: 9.5, color: C.ink, lineHeight: 1.5 },
  mutedText: { fontSize: 8.5, color: C.muted, lineHeight: 1.4 },
  section: { marginBottom: 22 },
  footerText: { fontSize: 7, color: C.muted, letterSpacing: 1 },
  badge: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, paddingVertical: 2, paddingHorizontal: 6, borderWidth: 0.75, borderRadius: 2 },
  card: { backgroundColor: C.softBg, borderWidth: 0.5, borderColor: C.line, borderRadius: 3, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row' },
  label: { fontSize: 7, letterSpacing: 1.4, color: C.muted, textTransform: 'uppercase', marginBottom: 2 },
});

function classificationColor(classification: string): string {
  if (classification === 'VERIFIED FINDING') return C.green;
  if (classification === 'MANUAL VALIDATION REQUIRED') return C.amber;
  if (classification === 'INSUFFICIENT DATA') return C.muted;
  return C.goldDim;
}

function statusColor(status: string): string {
  if (status === 'HEALTHY') return C.green;
  if (status === 'FRICTION') return C.amber;
  if (status === 'RISK') return C.red;
  if (status === 'MANUAL VALIDATION') return C.amber;
  return C.muted;
}

const Footer = ({ dto }: { dto: ExecutiveReportDTO }) => (
  <>
    <Text style={[s.footerText, { position: 'absolute', bottom: 28, left: 52, width: 330 }]} fixed>
      {dto.cover.footer.toUpperCase()}
    </Text>
    <View style={{ position: 'absolute', bottom: 28, right: 52, width: 140 }} fixed>
      <Text style={[s.footerText, { textAlign: 'right' }]} render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`} />
    </View>
  </>
);

const SectionHeader = ({ kicker, title }: { kicker: string; title: string }) => (
  <View minPresenceAhead={80}>
    <Text style={s.sectionKicker}>{kicker}</Text>
    <Text style={s.h2}>{title}</Text>
    <View style={s.rule} />
  </View>
);

const DemoBanner = ({ dto }: { dto: ExecutiveReportDTO }) =>
  dto.cover.demoMode ? (
    <View style={{ borderWidth: 1, borderColor: C.goldDim, padding: 6, marginBottom: 14 }}>
      <Text style={{ fontSize: 8, letterSpacing: 2, color: C.goldDim, textAlign: 'center' }}>
        DEMONSTRATION DATA — THIS REPORT DESCRIBES A FICTIONAL RESTAURANT
      </Text>
    </View>
  ) : null;

const MetaStat = ({ value, label, onDark }: { value: string | number; label: string; onDark?: boolean }) => (
  <View style={{ borderWidth: 0.75, borderColor: onDark ? C.goldDim : C.line, borderRadius: 2, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', minWidth: 78 }}>
    <Text style={{ fontFamily: 'Times-Bold', fontSize: 15, color: onDark ? C.gold : C.ink }}>{value}</Text>
    <Text style={{ fontSize: 6, letterSpacing: 0.8, color: onDark ? '#9a9080' : C.muted, textTransform: 'uppercase', marginTop: 2 }}>{label}</Text>
  </View>
);

function ScenarioBlock({ scenario, compact }: { scenario: RevenueScenario; compact?: boolean }) {
  return (
    <View style={{ backgroundColor: C.goldWash, borderWidth: 0.75, borderColor: C.goldDim, borderRadius: 3, padding: 12, marginTop: compact ? 8 : 0, marginBottom: compact ? 0 : 12 }} wrap={false}>
      <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }]}>
        <Text style={{ fontFamily: 'Times-Bold', fontSize: 11, color: C.ink }}>{scenario.pathwayTitle}</Text>
        <Text style={[s.badge, { color: C.goldDim, borderColor: C.goldDim }]}>{scenario.classification}</Text>
      </View>
      <Text style={[s.label]}>Observed friction</Text>
      <Text style={[s.body, { marginBottom: 6 }]}>{scenario.observedFriction}</Text>
      <View style={[s.row, { gap: 12 }]}>
        <View style={{ flex: 1.4 }}>
          <Text style={s.label}>Illustrative assumptions</Text>
          {scenario.assumptions.map((a: RevenueScenario['assumptions'][number], i: number) => (
            <View key={i} style={[s.row, { justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 2 }]}>
              <Text style={{ fontSize: 8, color: C.ink }}>{a.label}</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink }}>{a.value}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 6.8, color: C.muted, marginTop: 4 }}>Formula: {scenario.formula}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: C.paper, borderWidth: 0.5, borderColor: C.line, borderRadius: 2, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={s.label}>Illustrative monthly</Text>
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 13, color: C.goldDim }}>{scenario.monthlyExposure}</Text>
          <Text style={[s.label, { marginTop: 5 }]}>Illustrative annual</Text>
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 17, color: C.goldDim }}>{scenario.annualExposure}</Text>
        </View>
      </View>
      <Text style={[s.label, { marginTop: 6 }]}>Data required to validate</Text>
      <Text style={{ fontSize: 8, color: C.ink, marginBottom: 5 }}>{scenario.dataRequiredToValidate.join(' · ')}</Text>
      <Text style={{ fontSize: 7, color: C.goldDim, fontFamily: 'Helvetica-Bold', borderTopWidth: 0.5, borderTopColor: C.goldDim, paddingTop: 4 }}>
        {scenario.confidenceStatement}
      </Text>
    </View>
  );
}

export function ExecutivePdf({ dto }: { dto: ExecutiveReportDTO }) {
  return (
    <Document
      title={`${dto.cover.productName} — ${dto.cover.restaurantName}`}
      author={dto.cover.company}
      subject={dto.cover.subtitle}
      creator={dto.cover.company}
    >
      {/* ── COVER ─────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.cover}>
        <View>
          <Text style={{ fontSize: 9, letterSpacing: 4, color: C.gold }}>WINNERS BOOKMARK</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: C.goldDim, width: 60, marginTop: 10 }} />
        </View>
        <View>
          {dto.cover.demoMode && (
            <Text style={{ fontSize: 8, letterSpacing: 2, color: C.gold, marginBottom: 14 }}>DEMONSTRATION DATA — FICTIONAL RESTAURANT</Text>
          )}
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 34, color: C.ivory, lineHeight: 1.15 }}>RESTAURANT{'\n'}RESCUE AUDIT</Text>
          <Text style={{ fontSize: 10, color: C.gold, marginTop: 10, letterSpacing: 1 }}>{dto.cover.subtitle}</Text>
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontFamily: 'Times-Bold', fontSize: 18, color: C.ivory }}>{dto.cover.restaurantName}</Text>
            <Text style={{ fontSize: 9, color: '#b8b0a2', marginTop: 4 }}>
              {dto.cover.websiteUrl}
              {dto.cover.location ? `  ·  ${dto.cover.location}` : ''}
            </Text>
            <Text style={{ fontSize: 9, color: '#b8b0a2', marginTop: 2 }}>Audit date: {dto.cover.auditDate}</Text>
            {dto.cover.auditStatus === 'PARTIALLY_COMPLETED' && (
              <Text style={{ fontSize: 8, color: C.gold, marginTop: 6, letterSpacing: 1 }}>AUDIT PARTIALLY COMPLETED — SEE METHODOLOGY & LIMITATIONS</Text>
            )}
          </View>
          {/* Cover value block */}
          <View style={[s.row, { gap: 10, marginTop: 26 }]}>
            <MetaStat onDark value={dto.score.rescueScore ?? '—'} label="Rescue Score" />
            <MetaStat onDark value={dto.score.coverage !== null ? `${dto.score.coverage}%` : '—'} label="Coverage" />
            <MetaStat onDark value={dto.score.evidenceCount} label="Evidence Items" />
            <MetaStat onDark value={dto.score.sourcesAnalyzed} label="Pages Analyzed" />
          </View>
        </View>
        <View>
          <Text style={{ fontSize: 9, color: '#b8b0a2' }}>{dto.cover.preparedBy}</Text>
          <Text style={{ fontSize: 7.5, color: '#9a9080', marginTop: 3 }}>{dto.valueSignals.confidentialityNote}</Text>
          <Text style={{ fontSize: 7, color: '#7d766a', marginTop: 8, letterSpacing: 1.5 }}>{dto.cover.footer.toUpperCase()}</Text>
        </View>
      </Page>

      {/* ── BODY ──────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page} wrap>
        <Footer dto={dto} />
        <DemoBanner dto={dto} />

        {/* EXECUTIVE REVENUE SNAPSHOT */}
        <View style={s.section}>
          <SectionHeader kicker="At a Glance" title="Executive Revenue Snapshot" />
          <Text style={[s.mutedText, { marginBottom: 8 }]}>The whole audit in sixty seconds — the top priorities, the score, and the single most important thing to validate.</Text>
          {dto.snapshot.priorities.length > 0 ? (
            <View style={[s.row, { gap: 8, marginBottom: 10 }]}>
              {dto.snapshot.priorities.map((p) => (
                <View key={p.rank} style={{ flex: 1, backgroundColor: C.softBg, borderWidth: 0.5, borderColor: C.line, borderTopWidth: 2, borderTopColor: C.gold, borderRadius: 3, padding: 10 }}>
                  <Text style={{ fontSize: 6.5, letterSpacing: 1.2, color: C.goldDim, textTransform: 'uppercase' }}>Priority {String(p.rank).padStart(2, '0')}</Text>
                  <Text style={{ fontFamily: 'Times-Bold', fontSize: 10.5, color: C.ink, marginTop: 3 }}>{p.title}</Text>
                  <Text style={{ fontSize: 6.5, letterSpacing: 1, color: C.amber, textTransform: 'uppercase', marginTop: 3 }}>{p.priorityLabel}</Text>
                  <Text style={{ fontSize: 8, color: C.ink, marginTop: 5, lineHeight: 1.4 }}>{p.summary}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[s.body, { marginBottom: 10 }]}>No high-priority revenue leaks were confirmed from public evidence. The recommended next step is validating what public analysis cannot see.</Text>
          )}
          <View style={[s.card, { marginBottom: 0 }]}>
            {[
              ['Rescue Score', `${dto.snapshot.rescueScore ?? '—'}${dto.snapshot.band ? ` · ${dto.snapshot.band}` : ''}`],
              ['Coverage', dto.snapshot.coverage !== null ? `${dto.snapshot.coverage}%` : '—'],
              ['Top Recommended Automation', dto.snapshot.topRecommendedAutomation ?? 'Validate first — no automation recommended yet'],
              ['Primary Validation', dto.snapshot.primaryValidationRequirement],
              ['Recommended Next Step', dto.snapshot.recommendedNextStep],
            ].map(([label, value]) => (
              <View key={label} style={[s.row, { paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.line }]}>
                <Text style={{ width: 150, fontSize: 7, letterSpacing: 1, color: C.muted, textTransform: 'uppercase' }}>{label}</Text>
                <Text style={{ flex: 1, fontSize: 8.5, color: C.ink }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* EXECUTIVE SUMMARY */}
        <View style={s.section}>
          <SectionHeader kicker="Section 01" title="Executive Summary" />
          <Text style={s.body}>{dto.executiveSummary}</Text>
        </View>

        {/* SCORE */}
        <View style={s.section}>
          <SectionHeader kicker="Section 02" title="Restaurant Rescue Score" />
          <View style={[s.row, { gap: 14, marginBottom: 10 }]}>
            <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={[s.label, { marginBottom: 4 }]}>Rescue Score</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: 32, color: C.goldDim, marginBottom: 4 }}>
                {dto.score.rescueScore === null ? '—' : `${dto.score.rescueScore} / 100`}
              </Text>
              {dto.score.band && <Text style={{ fontSize: 7.5, color: C.muted, letterSpacing: 1 }}>{dto.score.band}</Text>}
            </View>
            <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={[s.label, { marginBottom: 4 }]}>Audit Coverage</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: 32, color: C.ink, marginBottom: 4 }}>
                {dto.score.coverage === null ? '—' : `${dto.score.coverage}%`}
              </Text>
              <Text style={{ fontSize: 7.5, color: C.muted, textAlign: 'center' }}>Share of the intended audit scope with sufficient public evidence</Text>
            </View>
          </View>
          <Text style={[s.body, { marginBottom: 8 }]}>{dto.score.interpretation}</Text>
          <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
            {[
              [`${dto.score.evidenceCount}`, 'Evidence items'],
              [`${dto.score.sourcesAnalyzed}`, 'Pages analyzed'],
              [`${dto.score.verifiedCount}`, 'Verified findings'],
              [`${dto.score.inferredCount}`, 'Inferred opportunities'],
              [`${dto.score.manualValidationCount}`, 'Require manual validation'],
            ].map(([n, label]) => (
              <View key={label} style={{ borderWidth: 0.5, borderColor: C.line, borderRadius: 2, paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.ink }}>{n}</Text>
                <Text style={{ fontSize: 6.5, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* WHAT THIS COULD BE COSTING YOU */}
        {dto.scenarios.length > 0 && (
          <View style={s.section}>
            <SectionHeader kicker="Section 03" title="What This Could Be Costing You" />
            <View style={{ borderWidth: 0.75, borderColor: C.goldDim, borderRadius: 3, padding: 6, marginBottom: 10 }}>
              <Text style={{ fontSize: 7.5, color: C.goldDim, textAlign: 'center', letterSpacing: 0.5 }}>
                Illustrative scenarios — not confirmed losses. Every assumption is shown so you can replace it with your real numbers.
              </Text>
            </View>
            {dto.scenarios.map((sc) => <ScenarioBlock key={sc.key} scenario={sc} />)}
          </View>
        )}

        {/* TOP REVENUE LEAKS */}
        <View style={s.section}>
          <SectionHeader kicker="Section 04" title="Top Revenue Leaks" />
          {dto.findings.length === 0 && (
            <Text style={s.body}>
              No high-priority revenue leaks were confirmed from public evidence. Remaining risk sits in areas a public audit cannot see — phone handling, follow-up, and repeat business — which we recommend validating directly.
            </Text>
          )}
          {dto.findings.map((f) => (
            <View key={f.number} style={[s.card, { marginBottom: 14 }]} minPresenceAhead={130}>
              <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }]}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 12, color: C.ink, flex: 1, paddingRight: 8 }}>
                  {f.number}. {f.title}
                </Text>
                <Text style={[s.badge, { color: classificationColor(f.classification), borderColor: classificationColor(f.classification) }]}>{f.classification}</Text>
              </View>
              <Text style={[s.mutedText, { marginBottom: 6 }]}>Customer journey stage: {f.journeyStage} · Priority: {f.labels.priority}</Text>
              <Text style={[s.label]}>The business problem</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>{f.problem}</Text>
              <Text style={[s.label]}>Why it matters</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>{f.whyItMatters}</Text>
              <Text style={[s.label]}>Potential commercial effect</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>{f.commercialEffect}</Text>
              <Text style={[s.label]}>What we know</Text>
              {f.whatWeKnow.map((k, i) => (
                <Text key={i} style={[s.body, { marginBottom: 2 }]}>•  {k}</Text>
              ))}
              <Text style={[s.label, { marginTop: 5 }]}>What we do not yet know</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>{f.whatWeDoNotKnow}</Text>
              <Text style={[s.label]}>Recommended next action</Text>
              <Text style={[s.body, { marginBottom: 8 }]}>{f.recommendedAction}</Text>
              {f.scenario && <ScenarioBlock scenario={f.scenario} compact />}
              <View style={[s.row, { gap: 14, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6, marginTop: 8 }]}>
                {[
                  ['Business impact', f.labels.businessImpact],
                  ['Urgency', f.labels.urgency],
                  ['Evidence confidence', f.labels.evidenceConfidence],
                  ['Automation opportunity', f.labels.automationOpportunity],
                ].map(([label, value]) => (
                  <View key={label}>
                    <Text style={{ fontSize: 6.5, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' }}>{label}</Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.ink }}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* VISUAL CUSTOMER JOURNEY */}
        <View style={s.section}>
          <SectionHeader kicker="Section 05" title="Customer Journey Map" />
          <Text style={[s.mutedText, { marginBottom: 8 }]}>Where guest friction clusters across the journey, from discovery to return.</Text>
          {dto.journeyMap.map((stage, i) => (
            <View key={stage.stage} wrap={false}>
              <View style={[s.row, { alignItems: 'center', gap: 10 }]}>
                <Text style={{ width: 118, fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, textAlign: 'center', color: statusColor(stage.status), borderWidth: 0.75, borderColor: statusColor(stage.status), borderRadius: 2, paddingVertical: 3 }}>
                  {stage.status}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.ink }}>{stage.label}</Text>
                  <Text style={{ fontSize: 7.5, color: C.muted }}>{stage.note}</Text>
                </View>
              </View>
              {i < dto.journeyMap.length - 1 && <View style={{ marginLeft: 59, height: 6, borderLeftWidth: 0.75, borderLeftColor: C.line }} />}
            </View>
          ))}
        </View>

        {/* RANKED AI OPPORTUNITIES */}
        <View style={s.section}>
          <SectionHeader kicker="Section 06" title="AI Automation Opportunities" />
          {dto.rankedAiOpportunities.length === 0 ? (
            <Text style={s.body}>
              No automation is recommended from current public evidence. The strongest next step is completing the validation items in the 30-day plan; automation should follow demand, not precede it.
            </Text>
          ) : (
            dto.rankedAiOpportunities.map((opp) => (
              <View key={opp.rank} style={s.card} minPresenceAhead={60}>
                <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }]}>
                  <Text style={{ fontFamily: 'Times-Bold', fontSize: 11.5, color: C.ink }}>#{opp.rank} · {opp.solutionCategory}</Text>
                  <Text style={[s.badge, { color: C.goldDim, borderColor: C.goldDim }]}>FIT: {opp.fit}</Text>
                </View>
                <Text style={s.label}>Problem addressed</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.problemAddressed}</Text>
                <Text style={s.label}>Why it fits</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.whyItFits}</Text>
                <Text style={s.label}>What it can do</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.capabilities.join(' · ')}</Text>
                <Text style={s.label}>Validation before implementation</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.validationBeforeImplementation}</Text>
                <View style={[s.row, { gap: 16, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5 }]}>
                  <View><Text style={s.label}>Complexity</Text><Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink }}>{opp.implementationComplexity}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.label}>Measurement</Text><Text style={{ fontSize: 8, color: C.muted }}>{opp.measurement.join(' · ')}</Text></View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* WINNERS BOOKMARK PRESCRIPTION */}
        <View style={s.section}>
          <SectionHeader kicker="Section 07" title="Winners Bookmark Prescription" />
          {[
            ['Diagnosis', dto.prescription.diagnosis, false],
            ['Validation', dto.prescription.validation, false],
            ['Prescription', dto.prescription.prescription, true],
          ].map(([label, text, highlight]) => (
            <View key={label as string} style={[s.card, highlight ? { borderColor: C.goldDim, backgroundColor: C.goldWash } : {}]} wrap={false}>
              <Text style={{ fontSize: 7.5, letterSpacing: 1.4, color: highlight ? C.goldDim : C.muted, textTransform: 'uppercase', marginBottom: 3 }}>{label as string}</Text>
              <Text style={s.body}>{text as string}</Text>
            </View>
          ))}
          <View style={s.card} wrap={false}>
            <Text style={s.label}>Expected operational role</Text>
            {dto.prescription.expectedOperationalRole.map((r, i) => (
              <Text key={i} style={[s.body, { marginTop: 2 }]}>•  {r}</Text>
            ))}
          </View>
        </View>

        {/* DECISION BOX */}
        <View style={s.section} wrap={false}>
          <SectionHeader kicker="Section 08" title="The Decision" />
          <View style={[s.row, { gap: 8 }]}>
            {[
              [dto.decisionBox.doNothing.heading, dto.decisionBox.doNothing.detail, [['Risk', dto.decisionBox.doNothing.risk]], C.muted],
              [dto.decisionBox.validate.heading, dto.decisionBox.validate.detail, [['Cost', dto.decisionBox.validate.cost], ['Benefit', dto.decisionBox.validate.benefit]], C.goldDim],
              [dto.decisionBox.implement.heading, dto.decisionBox.implement.detail, [['Benefit', dto.decisionBox.implement.benefit]], C.green],
            ].map(([heading, detail, rows, accent]) => (
              <View key={heading as string} style={{ flex: 1, backgroundColor: C.softBg, borderWidth: 0.5, borderColor: C.line, borderTopWidth: 2, borderTopColor: accent as string, borderRadius: 3, padding: 10 }}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 11, color: accent as string, marginBottom: 4 }}>{heading as string}</Text>
                <Text style={{ fontSize: 8, color: C.ink, lineHeight: 1.4, marginBottom: 4 }}>{detail as string}</Text>
                {(rows as [string, string][]).map(([k, v]) => (
                  <Text key={k} style={{ fontSize: 7.5, color: C.muted, marginTop: 2 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>{k}: </Text>{v}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* 30-DAY PLAN */}
        <View style={s.section}>
          <SectionHeader kicker="Section 09" title="30-Day Restaurant Rescue Plan" />
          {dto.thirtyDayPlan.map((phase) => (
            <View key={phase.phase} style={{ marginBottom: 10 }} wrap={false}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1.6, color: C.goldDim }}>
                {phase.phase} — {phase.heading}
              </Text>
              {phase.actions.map((a, i) => (
                <Text key={i} style={[s.body, { marginTop: 3 }]}>•  {a}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* CTA + QR */}
        <View style={s.section} wrap={false}>
          <View style={{ backgroundColor: C.obsidian, borderRadius: 4, padding: 20 }}>
            <View style={[s.row, { alignItems: 'center', gap: 18 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 15, color: C.gold, marginBottom: 5 }}>{dto.cta.headline}</Text>
                <Text style={{ fontSize: 9, color: C.ivory, lineHeight: 1.4, marginBottom: 10 }}>{dto.cta.subtext}</Text>
                <Text style={{ fontSize: 9.5, color: C.ivory, fontFamily: 'Helvetica-Bold' }}>{dto.cta.consultantName} · {dto.cta.company}</Text>
                <Text style={{ fontSize: 9, color: '#b8b0a2', marginTop: 2 }}>
                  {dto.cta.phone}{dto.cta.email ? ` · ${dto.cta.email}` : ''}
                </Text>
                {!dto.cta.qrDataUrl && dto.cta.bookingUrl && (
                  <Text style={{ fontSize: 8.5, color: C.gold, marginTop: 4 }}>{dto.cta.bookingUrl}</Text>
                )}
                {!dto.cta.qrDataUrl && !dto.cta.bookingUrl && (
                  <Text style={{ fontSize: 8.5, color: '#b8b0a2', marginTop: 6 }}>{dto.cta.fallbackText}</Text>
                )}
              </View>
              {dto.cta.qrDataUrl && (
                <View style={{ alignItems: 'center' }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={dto.cta.qrDataUrl} style={{ width: 96, height: 96, backgroundColor: C.paper, padding: 4, borderRadius: 3 }} />
                  <Text style={{ fontSize: 6.5, letterSpacing: 1, color: '#9a9080', textTransform: 'uppercase', marginTop: 4 }}>Scan to book</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* METHODOLOGY */}
        <View style={s.section}>
          <SectionHeader kicker="Section 10" title="Methodology & Limitations" />
          {dto.methodologyAndLimitations.map((line, i) => (
            <Text key={i} style={[s.body, { marginBottom: 4 }]}>•  {line}</Text>
          ))}
        </View>

        {/* APPENDIX */}
        <View style={s.section}>
          <SectionHeader kicker="Appendix" title="Full Evidence Chain" />
          <Text style={[s.mutedText, { marginBottom: 8 }]}>
            Every material claim in this report traces to the evidence below, collected from publicly accessible pages on the audit date.
          </Text>
          {dto.appendix.map((e, i) => (
            <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 4 }} wrap={false}>
              <Text style={{ fontSize: 8.5, color: C.ink }}>{e.fact}</Text>
              <Text style={{ fontSize: 6.8, color: C.muted, marginTop: 1 }}>
                {e.evidenceType}
                {e.sourceUrl ? ` · ${e.sourceUrl.slice(0, 90)}` : ''}
                {` · confidence ${e.confidence}%`}
              </Text>
            </View>
          ))}
          <Text style={{ fontSize: 6.8, color: C.muted, marginTop: 10, letterSpacing: 0.5 }}>
            {dto.valueSignals.confidentialityNote} · Prepared for {dto.valueSignals.preparedFor} by {dto.valueSignals.preparedBy} · Audit {dto.valueSignals.auditId} · {dto.valueSignals.auditDate}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
