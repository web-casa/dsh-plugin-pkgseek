# dsh-plugin-pkgseek

[![npm version](https://img.shields.io/npm/v/dsh-plugin-pkgseek)](https://www.npmjs.com/package/dsh-plugin-pkgseek)
[![ci](https://github.com/web-casa/dsh-plugin-pkgseek/actions/workflows/ci.yml/badge.svg)](https://github.com/web-casa/dsh-plugin-pkgseek/actions/workflows/ci.yml)

[PkgSeek](https://github.com/yeagoo/pkgseek) Linux package, command and CVE
intelligence as native [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(DSH) tools — plus a system-prompt segment that tells the agent when to use them.

The plugin is a thin adapter over PkgSeek's public MCP-over-HTTP endpoint: at
load time it fetches `tools/list` and registers one native DSH tool per
definition (names prefixed `pkgseek_`), so tools go through the same approval,
guard and logging pipeline as built-in tools. Every call is forwarded as
`tools/call` to the hosted API — all tools are read-only and need no API key.

## Install

```sh
# interactive (web) profile
dsh plugin --profile web add dsh-plugin-pkgseek
# one-shot (headless) profile — dsh run uses this one
dsh plugin --profile headless add dsh-plugin-pkgseek
```

web and headless are separate profiles; install into both if you use both.
The package is published on npm as
[`dsh-plugin-pkgseek`](https://www.npmjs.com/package/dsh-plugin-pkgseek);
`dsh plugin add` resolves it from the registry. Installing from the GitHub
source also works (`dsh plugin --profile web add github:web-casa/dsh-plugin-pkgseek`).

## Verification

The 0.1.0 release was smoke-tested against a live `dsh` 0.1.0-rc.6 headless
profile: the plugin loaded, fetched `tools/list` from the production API,
registered `pkgseek_resolve_install`, the model called it, and the session
log shows the API answer (`sudo apt install ripgrep`) flowing back through
`tools/call`. Unit tests cover the JSON-RPC client, the schema adapter, the
offline snapshot and the config surface (`npm test`).

## Configuration

All settings are optional and live in the plugin's `config:` row:

```yaml
- id: pkgseek
  name: dsh-plugin-pkgseek
  config:
    apiBase: https://api.pkgseek.com   # any PkgSeek API deployment
    timeoutMs: 20000                   # per-request timeout
    promptGuidance: true               # register the usage-guidance prompt section
    refreshTools: true                 # refresh tools/list at load (snapshot fallback)
    enabledTools: []                   # allowlist of unprefixed names; empty = all
```

If the live `tools/list` fails at load time (offline, API down), the plugin
registers from its bundled snapshot and tool calls fail individually with a
clear error instead of breaking the profile.

## Tools

22 read-only tools, registered with the `pkgseek_` prefix:

- Command/tool intelligence: `pkgseek_search_tools`, `pkgseek_get_tool`,
  `pkgseek_resolve_install`, `pkgseek_identify_binary`,
  `pkgseek_query_file_provides`, `pkgseek_compare_distros`, `pkgseek_get_context`
- Error & command doctor: `pkgseek_diagnose_linux_error`, `pkgseek_lint_command`,
  `pkgseek_explain_command`, `pkgseek_suggest_fix`
- Packages: `pkgseek_search_packages`, `pkgseek_get_package`,
  `pkgseek_compare_package_versions`, `pkgseek_get_package_history`
- Vulnerabilities: `pkgseek_search_vulnerabilities`, `pkgseek_get_vulnerability`
- Lifecycle & migration: `pkgseek_check_release_lifecycle`,
  `pkgseek_get_distro_lifecycle`, `pkgseek_compare_distro_releases`,
  `pkgseek_plan_distro_migration`
- Meta: `pkgseek_get_repository_health`

## Development

```sh
npm install
npm run sync-tools   # refresh tools.snapshot.json from the live endpoint
npm test             # build + node --test
```

Layout: `src/mcp-client.ts` (JSON-RPC over HTTP), `src/adapter.ts` (MCP tool
definitions → `defineTool`), `src/prompt.ts` (guidance section),
`src/index.ts` (wiring, config schema).

## License

MIT
