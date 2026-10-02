# Dependency audit policy

The CI runs `node scripts/check-dependency-audit.cjs`, which executes
`pnpm audit --prod --json` without ignoring registry errors. No dependency is
updated. All returned advisories remain visible in the raw report and CI logs.

## Decision

- Any CRITICAL blocks, regardless of baseline membership.
- A HIGH passes with a warning only when its advisory ID, GHSA, package,
  affected range, installed versions and dependency paths exactly match a
  manually approved C/D entry with an unexpired review date.
- New or changed HIGH findings block. Removed findings pass and are reported
  as candidates for manual baseline removal, never removed automatically.
- MODERATE, LOW and INFO are reported without automatic blocking.
- Registry/network/process failure, missing pnpm, invalid JSON, inconsistent
  counts, unsupported report format and invalid baseline block (fail closed).
- Invalid or expired baseline blocks even when its finding has disappeared.

The baseline records applicability, not a reduction in official severity.
C means build/dev/CLI usage; D means an absent or mitigated vulnerable path
in the examined code. Neither classification means the dependency is safe in
all configurations. Changes to application code can invalidate D without
changing the lockfile. An A/B finding must block: remove its exception and
address/review its exposure before proceeding.

## Manual review

Initial approval: 2026-10-01, checkpoint `6583c61`; 21 HIGH (17 C, 4 D).
Review deadline: 2026-10-31 at 00:00 UTC (30 days). Each entry must have a
review deadline no more than 30 days after its approval. Renewals require
rechecking the official advisory, actual dependency chain, code use and
mitigation, recording the rationale and new dates in a reviewed change.
Do not approve by count alone or automatically copy a fresh audit into the
baseline. Context and paths must be re-reviewed when changed. No wildcards
are accepted. Normalization only trims strings and sorts/deduplicates paths;
workspace names and chain segments are preserved.

When a finding disappears, confirm the new dependency/version or advisory
change and remove the obsolete baseline entry in a later reviewed change.
The checker never writes the baseline. Baseline entries allow HIGH only.

## Reports and local verification

`dependency-audit.json` contains the unchanged valid JSON output and is
uploaded by CI even if the policy fails. Registry content is untrusted data:
it is never evaluated or used to build executable commands. Console JSON is
escaped to prevent workflow-command injection; errors are concise. A GitHub
step summary lists counts and approved, unapproved and expired HIGH findings.

Run `node --check scripts/check-dependency-audit.cjs`,
`node scripts/check-dependency-audit.cjs --self-test` and then the checker
without arguments for a real audit. Self-tests use in-memory fixtures only.
On Windows the checker resolves the existing pnpm/corepack Node launcher
from PATH, without a command shell or new installation.

The root report is a runtime artifact, not a source file. The existing
`.gitignore` does not ignore it; after a local run, remove only that generated
file before reviewing/staging changes. Never commit the report. No ignore
file is changed by this policy. On operational failures no valid JSON may
exist; the checker fails and artifact upload also reports a missing report.
