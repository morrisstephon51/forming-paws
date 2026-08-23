/**
 * Kept out of page.tsx so a jsdom test run can import it without dragging in
 * next/navigation and the Server Component machinery. Same reason
 * locationSchema lives in lib/validators/location.ts.
 */
export function dogListLabel(name: string, sex: string, isVerified: boolean): string {
  return `${name} · ${sex} · ${isVerified ? '✓ Health verified' : 'Verification pending'}`
}
