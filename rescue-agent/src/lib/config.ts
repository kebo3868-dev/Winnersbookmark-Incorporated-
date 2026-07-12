/**
 * Company configuration — the single place contact and product details live so
 * they are never scattered through report templates. Values here are PUBLIC
 * (they appear on client deliverables); never put secrets in this file.
 */
export const COMPANY = {
  name: 'Winners Bookmark Incorporated',
  shortName: 'Winners Bookmark',
  founder: 'Keith Warren',
  phone: '727-291-5965',
  footer: 'Designed by Winnersbookmark Incorporated',
  productName: 'Restaurant Rescue Audit',
  reportSubtitle: 'Restaurant Revenue Intelligence & AI Opportunity Assessment',
  nextStepCta: 'Schedule a 20-minute Restaurant Rescue Review to compare the public audit with your actual operating data.',
} as const;
