import QRCode from 'qrcode';

/**
 * Generate a QR code as a PNG data URL, usable directly by both the web report
 * (<img src>) and the PDF (<Image src>). Pure-JS (no external QR service, no
 * network, no credentials). Returns null on any failure so callers fall back
 * to the phone-based CTA rather than rendering a broken code.
 *
 * Only http/https targets are encoded — never internal data or secrets.
 */
export async function generateBookingQrDataUrl(bookingUrl: string | null): Promise<string | null> {
  if (!bookingUrl) return null;
  if (!/^https?:\/\/\S+$/.test(bookingUrl)) return null;
  try {
    new URL(bookingUrl);
  } catch {
    return null;
  }
  try {
    return await QRCode.toDataURL(bookingUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
      color: { dark: '#1a1712ff', light: '#ffffffff' },
    });
  } catch {
    return null;
  }
}
