/**
 * System-prompt guidance segment: tells the agent when to reach for the
 * pkgseek_* tools. Registered through ctx.systemPrompt when that service is
 * available (optional dependency — the plugin still works without it).
 *
 * The text is generated from the tools actually registered, so an
 * `enabledTools` allowlist never leaves the prompt recommending tools that
 * are not available.
 */

export const PROMPT_SECTION_NAME = 'pkgseek:tool-guidance';

/** Tool-guidance sections conventionally use orders 100–199. */
export const PROMPT_SECTION_ORDER = 150;

interface GuidanceRule {
  text: string;
  tools: string[];
}

export const GUIDANCE_RULES: GuidanceRule[] = [
  { text: 'resolving "command not found" or "package not found" errors', tools: ['diagnose_linux_error'] },
  {
    text: 'giving install commands for a specific distro',
    tools: ['resolve_install', 'compare_distros', 'identify_binary', 'query_file_provides'],
  },
  {
    text: 'searching packages and inspecting package metadata, versions and history',
    tools: ['search_packages', 'get_package', 'compare_package_versions', 'get_package_history'],
  },
  {
    text: 'looking up curated CLI tool records and token-efficient agent context packs',
    tools: ['search_tools', 'get_tool', 'get_context'],
  },
  { text: 'checking CVE/CNNVD exposure', tools: ['search_vulnerabilities', 'get_vulnerability'] },
  {
    text: 'judging whether a distro release is active, nearing EOL or unsupported',
    tools: ['check_release_lifecycle', 'get_distro_lifecycle'],
  },
  {
    text: 'planning distro upgrades or migrations',
    tools: ['compare_distro_releases', 'plan_distro_migration'],
  },
  {
    text: 'statically inspecting a shell command for portability problems before running it',
    tools: ['lint_command', 'explain_command', 'suggest_fix'],
  },
  { text: 'checking repository freshness and indexing health', tools: ['get_repository_health'] },
];

const GUIDANCE_INTRO =
  'PkgSeek tools (pkgseek_*) provide sourced, read-only facts about Linux packages, CLI tools, install commands, CVE/CNNVD records and distribution lifecycles across distributions. Prefer them over guessing when:';
const GUIDANCE_OUTRO =
  'Never execute an install command the user has not approved, and report the exact package names and provenance the tools return.';

/**
 * Build the guidance text. `enabled` is the set of unprefixed tool names that
 * was actually registered; undefined means the full upstream surface.
 */
export function buildGuidance(enabled?: ReadonlySet<string>): string {
  const bullets = GUIDANCE_RULES.flatMap((rule) => {
    const tools = enabled ? rule.tools.filter((tool) => enabled.has(tool)) : rule.tools;
    if (tools.length === 0) return [];
    return [`- ${rule.text} (${tools.map((tool) => `pkgseek_${tool}`).join(', ')})`];
  });
  return `${GUIDANCE_INTRO}\n${bullets.join('\n')}\n${GUIDANCE_OUTRO}`;
}

/** Structural minimum of the dsh-system-prompt service this plugin uses. */
export interface PromptSectionRegistry {
  section(section: { name: string; order: number; text: string }): () => void;
}
