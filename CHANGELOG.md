# Changelog

## 0.1.1 — 2026-08-20

- Declare `dsh.platforms` (`web`, `desktop`) and the supported DSH range
  (`>=0.1.0-rc.7 <0.2.0`) in the published manifest. This is the exact
  registry evidence required by the Cordis v4 catalog; it does not change the
  plugin's runtime behavior or relax any client-side install gate.

## 0.1.0 — 2026-08-17

First public release.

- Thin adapter over the hosted PkgSeek MCP-over-HTTP endpoint: `tools/list`
  at load registers 22 read-only native tools with the `pkgseek_` prefix,
  calls are forwarded as `tools/call`.
- System-prompt guidance section generated from the actually registered tool
  set (optional; `promptGuidance` config).
- Offline cold-start fallback via a bundled `tools.snapshot.json`
  (`npm run sync-tools` refreshes it).
- Config: `apiBase`, `timeoutMs`, `promptGuidance`, `refreshTools`,
  `enabledTools`.
- Zero runtime dependencies; Node ≥ 18.
