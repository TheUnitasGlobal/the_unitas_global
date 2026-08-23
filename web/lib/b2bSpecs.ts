// Illustrative architecture-flow labels for the B2B "technical
// specification" panel. Kept as plain technical English rather than
// translated content, same convention as leaving protocol/API terms
// untranslated elsewhere -- these are diagram labels, not prose.
export const B2B_TECH_SPECS: Record<string, string[]> = {
  'u-signature': [
    'Client Request',
    'Biometric + Cryptographic Capture',
    'Sovereign Signature Engine',
    'Immutable Ledger Entry',
  ],
  'u-key': [
    'Access Request',
    'Zero-Trust Policy Engine',
    'Key Vault (HSM-backed)',
    'Scoped Credential Issued',
  ],
  'u-pay': [
    'Payment Intent',
    'Sovereign Fiscal Routing Engine',
    'Settlement Rail',
    'Confirmed Ledger Entry',
  ],
};
