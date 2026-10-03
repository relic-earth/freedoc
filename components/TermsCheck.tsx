'use client';
import type { ReactNode } from 'react';

export const TERMS_VERSION = '2026-10-03';
export const ACCEPT_TEXT = 'I am 18 or older and I agree to the Terms of Use (including binding individual arbitration, a class action and jury trial waiver, and a limitation of liability) and the Privacy Policy.';

const link = { textDecoration: 'underline', fontWeight: 700, color: 'inherit' } as const;

/** Unchecked-by-default clickwrap checkbox. Large, high-contrast text that inherits the surrounding theme color. */
export default function TermsCheck({ checked, onChange, disabled, children, name }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children?: ReactNode; name?: string }) {
  return (
    <label style={{ display: 'flex', gap: 14, alignItems: 'flex-start', fontSize: 18, lineHeight: 1.5, margin: '14px 0', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontWeight: 500 }}>
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} style={{ width: 26, height: 26, flexShrink: 0, marginTop: 2, accentColor: '#1d4ed8', cursor: 'pointer' }} />
      <span>{children ?? <AcceptText />}</span>
    </label>
  );
}

export function AcceptText() {
  return (
    <>
      I am 18 or older and I agree to the <a href="/terms" target="_blank" rel="noopener" style={link}>Terms of Use</a> (including binding individual arbitration, a class action and jury trial waiver, and a limitation of liability) and the <a href="/privacy" target="_blank" rel="noopener" style={link}>Privacy Policy</a>.
    </>
  );
}
