/**
 * Map PkgSeek MCP tool definitions (JSON Schema) onto native DSH tools.
 *
 * DSH `defineTool` uses its own ParameterSchemaSpec DSL: one property map,
 * `required: true` per property, and a closed set of value-schema node types
 * that does not carry JSON Schema validation keywords like minLength. The
 * mapping below keeps everything the model can see (type, description, enum,
 * default) and fails closed on anything unmappable.
 */
import { defineTool, type ParameterPropertySpec, type ParameterSchemaSpec, type ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { JsonValue, McpHttpClient, McpToolDef } from './mcp-client.js';

export const TOOL_PREFIX = 'pkgseek_';

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  title?: string;
  enum?: unknown[];
  default?: JsonValue;
  items?: { type?: string };
}

interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

function mapProperty(name: string, prop: JsonSchemaProperty, required: boolean): ParameterPropertySpec {
  const annotations = {
    ...(prop.description ? { description: prop.description } : {}),
    ...(prop.title ? { title: prop.title } : {}),
    ...(prop.default !== undefined ? { default: prop.default } : {}),
    ...(required ? { required: true as const } : {}),
  };
  switch (prop.type) {
    case 'string':
      if (prop.enum?.length) {
        const values = prop.enum.filter((value): value is string => typeof value === 'string');
        if (values.length !== prop.enum.length) {
          throw new Error(`tool property ${name}: non-string enum values are not mappable`);
        }
        return { ...annotations, type: 'string', enum: values };
      }
      return { ...annotations, type: 'string' };
    case 'integer':
      return { ...annotations, type: 'integer' };
    case 'number':
      return { ...annotations, type: 'number' };
    case 'boolean':
      return { ...annotations, type: 'boolean' };
    case 'array':
      if (prop.items?.type === 'string') {
        return { ...annotations, type: 'array', items: { type: 'string' } };
      }
      return { ...annotations, type: 'array' };
    case 'object':
      return { ...annotations, type: 'object', additionalProperties: true };
    default:
      throw new Error(`tool property ${name}: unsupported schema type ${JSON.stringify(prop.type)}`);
  }
}

/** Convert an MCP inputSchema (flat object) into a DSH ParameterSchemaSpec. */
export function mapParameters(toolName: string, inputSchema: JsonSchemaObject): ParameterSchemaSpec {
  if (inputSchema.type !== undefined && inputSchema.type !== 'object') {
    throw new Error(`tool ${toolName}: inputSchema root must be an object`);
  }
  const required = new Set(inputSchema.required ?? []);
  const parameters: ParameterSchemaSpec = {};
  for (const [key, prop] of Object.entries(inputSchema.properties ?? {})) {
    parameters[key] = mapProperty(`${toolName}.${key}`, prop, required.has(key));
  }
  return parameters;
}

/** Filter the upstream tool list by an allowlist of unprefixed names. */
export function selectTools(tools: McpToolDef[], enabledTools: string[]): McpToolDef[] {
  if (enabledTools.length === 0) return tools;
  const allow = new Set(enabledTools);
  return tools.filter((tool) => allow.has(tool.name));
}

function renderText(value: JsonValue): { type: 'text'; text: string }[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return [{ type: 'text', text }];
}

/** Build one native DSH tool that dispatches to the upstream MCP endpoint. */
export function buildTool(tool: McpToolDef, client: McpHttpClient, timeoutMs: number): ToolDefinition {
  const parameters = mapParameters(tool.name, tool.inputSchema as JsonSchemaObject);
  return defineTool({
    name: `${TOOL_PREFIX}${tool.name}`,
    description: tool.description ?? `PkgSeek ${tool.name}`,
    parameters,
    timeoutMs,
    isConcurrencySafe: () => true, // every PkgSeek tool is read-only
    output: {
      // PkgSeek results are heterogeneous JSON; 'json' is the unconstrained node.
      schema: { type: 'json' },
      render: (_args, value) => renderText(value as JsonValue),
    },
    execute: (args, exec) => client.callTool(tool.name, args as Record<string, unknown>, exec.signal),
  });
}
