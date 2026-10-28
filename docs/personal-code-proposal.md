# Personal code (personas kods) for users (proposal, Agent B → C/A, not approved)

## Today

- Drivers in C's data have `id`, `displayName`, licence fields and `birthYear`. There is no personal code.
- Login uses demo handles (`DEMO-SID-00x`). C's `demoAuth` deliberately rejects anything that looks like a personal code, so real codes are never handled.
- For the demo, B shows fictional personas in the UI (`web/src/demo/personas.ts`): names plus personal codes in the Latvian `DDMMYY-XNNNN` layout on **dates that do not exist** (30 Feb, 31 Apr, 31 Jun). They can never belong to a real person. They are display only and are not stored in C's data.

## Why it matters in a real product

- Smart-ID returns the person's identity: name and personal code (`PNOLV-…`).
- An insurer identifies a policyholder by personal code, and OCTA policies and the CSDD registry are keyed by it.
- The insurer portal needs a stable, verifiable identifier per driver, for matching, export and audit.

## Proposal

### Data model (C)

```ts
interface Driver {
  // existing fields …
  identity?: {
    personalCodeHash: string   // HMAC-SHA256(code, server secret): for matching, never reversible
    personalCodeMasked: string // "300291-*****": the only form shown in lists
    verifiedBy: 'smart-id-demo' | 'smart-id'
    verifiedAt: string         // ISO 8601
  }
}
```

- Never store the plain code on the phone. On a server, store it only where a legal basis exists (the insurer's policy system), encrypted at rest.
- Matching with the insurer uses the hash.
- The full code is shown only to the person themselves, and to an insurer they have consented to share with.
- Birth year can be derived from an old-format code. Keep using `birthYear` only, as today (data minimisation). New-format codes (since 2017) carry no birth date, so never rely on the code for age.

### Login (C)

- `IdentityProvider.signIn` returns `identity` from Smart-ID: the masked code and the hash.
- The demo provider returns the persona codes, clearly marked `verifiedBy: 'smart-id-demo'`.
- Keep rejecting typed personal codes in the demo login field.

### UI (B, already partly done)

| Where | Shown |
|---|---|
| Driver's own profile | Full code, with a DEMO tag |
| Insurer portal list | Masked code |
| Insurer driver page | Full code (only when the driver shares) |
| CSV export | Full code (only when the driver shares) |
| Logs | Never the code |

Once C adds `identity`, B switches from `personas.ts` to the real field.

### Validation (C)

- Old format: a valid date, the century digit, and the checksum.
- New format (`32…`): the prefix and the checksum.
- The demo persona codes are rejected as real codes by design (impossible dates), so tests can assert "demo codes never validate as real".

### GDPR

The personal code is personal data with a unique identifier.

- **Lawful basis:** contract with the insurer, or consent.
- **Purpose limitation:** identification and matching only.
- **Erasure:** deleting the account removes the hash and the masked code.
- **Insurer access:** row-level security per insurer, and only with active consent.

## Decisions for A

1. Show personal codes in the demo at all (fictional, impossible dates), or names only?
2. Add `identity` to C's model now, or keep the UI-only personas for the hackathon?
3. Should the insurer portal show the full code to consenting insurers, or masked only?
