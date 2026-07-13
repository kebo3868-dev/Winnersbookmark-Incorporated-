import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ExecutiveReportDTO } from '@/lib/reports/executive';

/**
 * Executive Audit Report PDF. Deterministic document generation via
 * @react-pdf/renderer (pure-JS layout engine — no headless browser, no binary
 * downloads, Vercel-serverless safe). PDF standard fonts (Times/Helvetica)
 * are used so nothing is fetched or bundled at runtime. The cover page is
 * obsidian for presentation; interior pages are ivory so the document prints
 * cleanly and reads well on a laptop.
 */

const C = {
  obsidian: '#0e0c09',
  brown: '#2e2014',
  gold: '#b8924a',
  goldDim: '#8a6f33',
  ivory: '#f4efe6',
  paper: '#ffffff',
  ink: '#211c15',
  muted: '#6f6758',
  line: '#ddd5c5',
  softBg: '#f7f3ea',
  green: '#3e6b4f',
  amber: '#8a6d2f',
  red: '#8a3b32',
};

const s = StyleSheet.create({
  cover: { backgroundColor: C.obsidian, color: C.ivory, padding: 56, justifyContent: 'space-between' },
  // NOTE: no page-level lineHeight — react-pdf 4.x fails to paint render-prop
  // Texts (page numbers) when the Page style sets an inherited lineHeight.
  page: { backgroundColor: C.paper, color: C.ink, paddingTop: 52, paddingBottom: 64, paddingHorizontal: 52, fontFamily: 'Helvetica', fontSize: 9.5 },
  kicker: { fontFamily: 'Helvetica', fontSize: 8, letterSpacing: 2.4, color: C.goldDim, textTransform: 'uppercase' },
  h1: { fontFamily: 'Times-Bold', fontSize: 20, color: C.ink, marginBottom: 8 },
  h2: { fontFamily: 'Times-Bold', fontSize: 14, color: C.ink, marginBottom: 6 },
  sectionKicker: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 2, color: C.goldDim, textTransform: 'uppercase', marginBottom: 4 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.gold, marginBottom: 12, width: 42 },
  body: { fontSize: 9.5, color: C.ink, lineHeight: 1.5 },
  mutedText: { fontSize: 8.5, color: C.muted, lineHeight: 1.4 },
  section: { marginBottom: 22 },
  footer: { position: 'absolute', bottom: 26, left: 52, right: 52, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6 },
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
          <View style={{ marginTop: 34 }}>
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
        </View>
        <View>
          <Text style={{ fontSize: 9, color: '#b8b0a2' }}>{dto.cover.preparedBy}</Text>
          <Text style={{ fontSize: 7, color: '#7d766a', marginTop: 8, letterSpacing: 1.5 }}>{dto.cover.footer.toUpperCase()}</Text>
        </View>
      </Page>

      {/* ── BODY ──────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page} wrap>
        <Footer dto={dto} />
        <DemoBanner dto={dto} />

        {/* Executive summary */}
        <View style={s.section}>
          <SectionHeader kicker="Section 01" title="Executive Summary" />
          <Text style={s.body}>{dto.executiveSummary}</Text>
        </View>

        {/* Score */}
        <View style={s.section}>
          <SectionHeader kicker="Section 02" title="Restaurant Rescue Score" />
          <View style={[s.row, { gap: 14, marginBottom: 10 }]}>
            <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={[s.label, { marginBottom: 4 }]}>Rescue Score</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: 32, lineHeight: 1, color: C.goldDim, marginBottom: 4 }}>
                {dto.score.rescueScore === null ? '—' : `${dto.score.rescueScore} / 100`}
              </Text>
              {dto.score.band && <Text style={{ fontSize: 7.5, color: C.muted, letterSpacing: 1 }}>{dto.score.band}</Text>}
            </View>
            <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={[s.label, { marginBottom: 4 }]}>Audit Coverage</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: 32, lineHeight: 1, color: C.ink, marginBottom: 4 }}>
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

        {/* Findings */}
        <View style={s.section}>
          <SectionHeader kicker="Section 03" title="Top Revenue Leaks" />
          {dto.findings.length === 0 && (
            <Text style={s.body}>
              No high-priority revenue leaks were confirmed from public evidence. Remaining risk sits in areas a public audit cannot see — phone handling, follow-up, and repeat business — which we recommend validating directly.
            </Text>
          )}
          {dto.findings.map((f) => (
            <View key={f.number} style={[s.card, { marginBottom: 14 }]} minPresenceAhead={150}>
              <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }]}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 12, color: C.ink, flex: 1, paddingRight: 8 }}>
                  {f.number}. {f.title}
                </Text>
                <Text style={[s.badge, { color: classificationColor(f.classification), borderColor: classificationColor(f.classification) }]}>{f.classification}</Text>
              </View>
              <Text style={[s.mutedText, { marginBottom: 6 }]}>Customer journey stage: {f.journeyStage} · Priority: {f.labels.priority}</Text>
              <Text style={[s.label]}>The problem</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>{f.problem}</Text>
              <Text style={[s.label]}>Why it matters</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>{f.whyItMatters}</Text>
              <Text style={[s.label]}>What we know</Text>
              {f.whatWeKnow.map((k, i) => (
                <Text key={i} style={[s.body, { marginBottom: 2 }]}>•  {k}</Text>
              ))}
              <Text style={[s.label, { marginTop: 5 }]}>What we do not yet know</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>{f.whatWeDoNotKnow}</Text>
              <Text style={[s.label]}>Recommended next action</Text>
              <Text style={[s.body, { marginBottom: 8 }]}>{f.recommendedAction}</Text>
              <View style={[s.row, { gap: 14, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6 }]}>
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

        {/* Journey scorecard */}
        <View style={s.section}>
          <SectionHeader kicker="Section 04" title="Customer Journey Scorecard" />
          {dto.journeyScorecard.map((row) => (
            <View key={row.stage} style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 5, alignItems: 'flex-start' }]} wrap={false}>
              <Text style={{ width: 90, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.ink }}>{row.label}</Text>
              <Text style={{ width: 105, fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: statusColor(row.status) }}>{row.status}</Text>
              <Text style={{ flex: 1, fontSize: 8, color: C.muted }}>{row.explanation}</Text>
            </View>
          ))}
        </View>

        {/* AI opportunities */}
        <View style={s.section}>
          <SectionHeader kicker="Section 05" title="AI & Automation Opportunities" />
          {dto.aiOpportunities.length === 0 ? (
            <Text style={s.body}>
              No automation is recommended from current public evidence. The strongest next step is completing the validation items in the 30-day plan; automation should follow demand, not precede it.
            </Text>
          ) : (
            dto.aiOpportunities.map((opp, i) => (
              <View key={i} style={s.card} minPresenceAhead={100}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 11.5, color: C.ink, marginBottom: 4 }}>{opp.solutionCategory}</Text>
                <Text style={s.label}>Problem addressed</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.problemAddressed}</Text>
                <Text style={s.label}>Why it fits this restaurant</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.whyItFits}</Text>
                <Text style={s.label}>Validation required first</Text>
                <Text style={[s.body, { marginBottom: 5 }]}>{opp.validationRequired}</Text>
                <Text style={s.mutedText}>Implementation complexity: {opp.complexity}</Text>
              </View>
            ))
          )}
        </View>

        {/* 30-day plan */}
        <View style={s.section}>
          <SectionHeader kicker="Section 06" title="30-Day Restaurant Rescue Plan" />
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

        {/* Recommendation */}
        <View style={s.section} wrap={false}>
          <SectionHeader kicker="Section 07" title="Winners Bookmark Recommendation" />
          <View style={[s.card, { borderColor: C.goldDim }]}>
            <Text style={[s.body, { marginBottom: 8 }]}>{dto.recommendation.body}</Text>
            <Text style={{ fontFamily: 'Times-Bold', fontSize: 11, color: C.ink, marginBottom: 4 }}>NEXT STEP</Text>
            <Text style={[s.body, { marginBottom: 10 }]}>{dto.recommendation.nextStep}</Text>
            <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 8 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.ink }}>{dto.recommendation.company}</Text>
              <Text style={s.mutedText}>{dto.recommendation.contactName} · {dto.recommendation.contactPhone}</Text>
            </View>
          </View>
        </View>

        {/* Methodology */}
        <View style={s.section}>
          <SectionHeader kicker="Section 08" title="Methodology & Limitations" />
          {dto.methodologyAndLimitations.map((line, i) => (
            <Text key={i} style={[s.body, { marginBottom: 4 }]}>•  {line}</Text>
          ))}
        </View>

        {/* Appendix */}
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
        </View>
      </Page>
    </Document>
  );
}
