'use client';

// U-Signature honeypot field (REV-13 spec §6).
//
// A hidden form field that no sighted human ever notices or fills in, but
// that a naive autofill / form-filling bot frequently populates anyway.
// `readHoneypot()` (lib/security/uSignature.ts) checks every input named
// `U_SIGNATURE_HONEYPOT_NAME` on the page for a non-empty value and, if it
// finds one, drives the behavioural score straight to the floor
// (`scoreUSignature` subtracts a full point). Mount this once anywhere
// inside `QuantumWhiteHome` -- it renders nothing visible and participates
// in no form submission of its own.
//
// Hidden via layout (not `display:none`), which some bots special-case and
// skip: the input is 1x1px, clipped, and pushed off-screen, while still
// being a real, focusable-by-tab-index-only DOM node that autofill can see.
// `aria-hidden` + `tabIndex={-1}` keep it out of the accessibility tree and
// the tab order for genuine visitors.

import type { CSSProperties } from 'react';
import { U_SIGNATURE_HONEYPOT_NAME } from '@/lib/security/uSignature';

const HONEYPOT_STYLE: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
  left: '-9999px',
  opacity: 0,
  pointerEvents: 'none',
};

export function USignatureHoneypot() {
  return (
    <input
      type="text"
      name={U_SIGNATURE_HONEYPOT_NAME}
      autoComplete="off"
      tabIndex={-1}
      aria-hidden="true"
      style={HONEYPOT_STYLE}
      defaultValue=""
    />
  );
}

export default USignatureHoneypot;
