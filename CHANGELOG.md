# Changelog

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
