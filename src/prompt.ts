/**
 * System-prompt guidance segment: tells the agent when to reach for the
 * pkgseek_* tools. Registered through ctx.systemPrompt when that service is
 * available (optional dependency — the plugin still works without it).
 */

export const PROMPT_SECTION_NAME = 'pkgseek:tool-guidance';

/** Tool-guidance sections conventionally use orders 100–199. */
export const PROMPT_SECTION_ORDER = 150;

export const PROMPT_GUIDANCE = `PkgSeek tools (pkgseek_*) provide sourced, read-only facts about Linux packages, CLI tools, install commands, CVE/CNNVD records and distribution lifecycles across distributions. Prefer them over guessing when:
- resolving "command not found" or "package not found" errors (pkgseek_diagnose_linux_error)
- giving install commands for a specific distro (pkgseek_resolve_install, pkgseek_compare_distros, pkgseek_identify_binary, pkgseek_query_file_provides)
- checking CVE/CNNVD exposure (pkgseek_search_vulnerabilities, pkgseek_get_vulnerability)
- judging whether a distro release is active, nearing EOL or unsupported (pkgseek_check_release_lifecycle, pkgseek_get_distro_lifecycle)
- planning distro upgrades or migrations (pkgseek_compare_distro_releases, pkgseek_plan_distro_migration)
- statically inspecting a shell command for portability problems before running it (pkgseek_lint_command, pkgseek_explain_command, pkgseek_suggest_fix)
Never execute an install command the user has not approved, and report the exact package names and provenance the tools return.`;

/** Structural minimum of the dsh-system-prompt service this plugin uses. */
export interface PromptSectionRegistry {
  section(section: { name: string; order: number; text: string }): () => void;
}
