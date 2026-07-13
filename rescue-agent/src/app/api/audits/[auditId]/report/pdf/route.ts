import { NextResponse } from 'next/server';
import React from 'react';
import { loadExecutiveReport } from '@/lib/reports/executiveData';
import { sanitizeFilename } from '@/lib/reports/executive';
import { ExecutivePdf } from '@/lib/pdf/ExecutivePdf';

// PDF generation is pure-JS (@react-pdf/renderer) — no browser binary — but
// give large audits headroom on serverless.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Executive Audit PDF download. Protected by the app-wide auth middleware
 * (this route is under /api/audits, which the matcher covers). The document
 * is generated from the stored audit only — the same DTO the web report
 * renders — and never embeds credentials, env values, or internal sales data.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const result = await loadExecutiveReport(auditId);
  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }
  if (result.status === 'not_ready') {
    return NextResponse.json(
      { error: `Audit is not ready for export (status: ${result.auditStatus}). The executive report is available once the audit completes.` },
      { status: 409 },
    );
  }

  try {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    type PdfElement = Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(React.createElement(ExecutivePdf, { dto: result.dto }) as unknown as PdfElement);
    const filename = `Winners-Bookmark-Rescue-Audit-${sanitizeFilename(result.dto.cover.restaurantName)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Executive PDF generation failed', error);
    return NextResponse.json({ error: 'PDF generation failed. The web report remains available.' }, { status: 500 });
  }
}
