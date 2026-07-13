import { describe, expect, it } from 'vitest';
import { generateBookingQrDataUrl } from '@/lib/reports/qrcode';

describe('generateBookingQrDataUrl', () => {
  it('produces a PNG data URL for a valid https booking URL', async () => {
    const url = await generateBookingQrDataUrl('https://book.example/keith');
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect((url as string).length).toBeGreaterThan(200);
  });

  it('returns null (no broken/fake QR) for missing or unsafe URLs', async () => {
    expect(await generateBookingQrDataUrl(null)).toBeNull();
    expect(await generateBookingQrDataUrl('')).toBeNull();
    expect(await generateBookingQrDataUrl('not-a-url')).toBeNull();
    expect(await generateBookingQrDataUrl('javascript:alert(1)')).toBeNull();
    expect(await generateBookingQrDataUrl('ftp://example.com')).toBeNull();
  });
});
