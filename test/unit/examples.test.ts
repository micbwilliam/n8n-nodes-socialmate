import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import type { INodeProperties, INodeTypeDescription } from 'n8n-workflow';
import { SocialMate } from '../../nodes/SocialMate/SocialMate.node';
import { SocialMateTrigger, EVENT_OPTIONS } from '../../nodes/SocialMateTrigger/SocialMateTrigger.node';
import { MESSAGE_RECEIVED_PAYLOAD } from '../fixtures/webhook-message-received';

/**
 * Every shipped example must import AND run. Two of them once could do neither
 * — plain `socialMate` nodes wired as AI tools ("Node does not have a
 * `supplyData` method defined"), and trigger expressions reading a `body` key
 * the Trigger never emits — and no test looked at examples/ at all.
 */
const EXAMPLES_DIR = join(__dirname, '..', '..', 'examples');
const PKG = 'n8n-nodes-socialmate';

interface WfNode {
	name: string;
	type: string;
	typeVersion?: number;
	parameters: Record<string, unknown>;
}
interface Workflow {
	nodes: WfNode[];
	connections: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>>;
}

const action = new SocialMate().description;
const trigger = new SocialMateTrigger().description;

/** This package's node types — n8n adds `<name>Tool` for a `usableAsTool` node. */
const PACKAGE_TYPES = new Set<string>([
	`${PKG}.${action.name}`,
	`${PKG}.${trigger.name}`,
	...[action, trigger].filter((d: INodeTypeDescription) => d.usableAsTool).map((d) => `${PKG}.${d.name}Tool`),
]);

/**
 * n8n core / LangChain node types the examples may use. Adding one here means
 * checking it exists in n8n (with that name) first.
 */
const CORE_TYPES = new Set<string>([
	'n8n-nodes-base.webhook',
	'n8n-nodes-base.stickyNote',
	'n8n-nodes-base.if',
	'n8n-nodes-base.scheduleTrigger',
	'@n8n/n8n-nodes-langchain.agent',
	'@n8n/n8n-nodes-langchain.lmChatOpenAi',
	'@n8n/n8n-nodes-langchain.lmChatDeepSeek',
	'@n8n/n8n-nodes-langchain.memoryBufferWindow',
	'@n8n/n8n-nodes-langchain.mcpTrigger',
]);

/** Parameters n8n adds to the generated Tool variant. */
const TOOL_ONLY_PARAMS = new Set(['descriptionType', 'toolDescription']);

/** The trigger events whose payload is `MESSAGE_RECEIVED_PAYLOAD`-shaped. */
const MESSAGE_EVENTS = new Set(['message.received', 'message.sent']);

const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.json'));

function load(file: string): Workflow {
	return JSON.parse(readFileSync(join(EXAMPLES_DIR, file), 'utf8')) as Workflow;
}

function strings(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') out.push(value);
	else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
	else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
	return out;
}

/** Walk `a.b.c` into the payload; report the first segment that is missing. */
function missingSegment(root: unknown, path: string[]): string | null {
	let cur: unknown = root;
	for (let i = 0; i < path.length; i++) {
		if (!cur || typeof cur !== 'object' || !(path[i] in (cur as object))) return path.slice(0, i + 1).join('.');
		cur = (cur as Record<string, unknown>)[path[i]];
	}
	return null;
}

function optionValues(prop: INodeProperties | undefined): string[] {
	return ((prop?.options ?? []) as Array<{ value?: unknown }>).map((o) => String(o.value));
}

/** The node types feeding `name` through a main connection. */
function mainParents(wf: Workflow, name: string): WfNode[] {
	const parents: WfNode[] = [];
	for (const [src, outputs] of Object.entries(wf.connections)) {
		for (const branch of outputs.main ?? []) {
			if (branch?.some((c) => c.node === name)) parents.push(wf.nodes.find((n) => n.name === src)!);
		}
	}
	return parents;
}

function isMessageTrigger(node: WfNode | undefined): boolean {
	if (!node || node.type !== `${PKG}.${trigger.name}`) return false;
	const events = (node.parameters.events as string[] | undefined) ?? ['message.received'];
	return events.length > 0 && events.every((e) => MESSAGE_EVENTS.has(e));
}

describe.each(files)('examples/%s', (file) => {
	const wf = load(file);
	const byName = new Map(wf.nodes.map((n) => [n.name, n]));

	it('uses only node types that exist (this package or n8n core)', () => {
		const unknown = wf.nodes.filter((n) => !PACKAGE_TYPES.has(n.type) && !CORE_TYPES.has(n.type)).map((n) => `${n.name}: ${n.type}`);
		expect(unknown).toEqual([]);
	});

	it('uses a typeVersion this package declares for its own nodes', () => {
		const bad = wf.nodes
			.filter((n) => PACKAGE_TYPES.has(n.type))
			.filter((n) => {
				const d = n.type === `${PKG}.${trigger.name}` ? trigger : action;
				return !([] as number[]).concat(d.version).includes(n.typeVersion ?? 1);
			})
			.map((n) => `${n.name}: ${n.type} v${n.typeVersion}`);
		expect(bad).toEqual([]);
	});

	it('connects only nodes that exist', () => {
		const dangling: string[] = [];
		for (const [src, outputs] of Object.entries(wf.connections)) {
			if (!byName.has(src)) dangling.push(`source ${src}`);
			for (const branch of Object.values(outputs).flat()) {
				for (const c of branch ?? []) if (!byName.has(c.node)) dangling.push(`${src} → ${c.node}`);
			}
		}
		expect(dangling).toEqual([]);
	});

	it('feeds an AI tool input only from Tool node types', () => {
		const bad: string[] = [];
		for (const [src, outputs] of Object.entries(wf.connections)) {
			const node = byName.get(src)!;
			if (outputs.ai_tool && !node.type.endsWith('Tool')) bad.push(`${src} (${node.type}) is wired as an AI tool`);
			// The plain action node has only a main output.
			if (node.type === `${PKG}.${action.name}` && Object.keys(outputs).some((k) => k !== 'main')) {
				bad.push(`${src} (${node.type}) has a non-main output`);
			}
			// The Tool variant is only meaningful on an AI tool connection.
			if (node.type === `${PKG}.${action.name}Tool` && !outputs.ai_tool) bad.push(`${src} is a Tool node with no ai_tool connection`);
		}
		expect(bad).toEqual([]);
	});

	it('sets only real resources, operations and parameters on SocialMate nodes', () => {
		const resourceProp = action.properties.find((p) => p.name === 'resource');
		const names = new Set(action.properties.map((p) => p.name));
		const problems: string[] = [];
		for (const n of wf.nodes.filter((x) => x.type === `${PKG}.${action.name}` || x.type === `${PKG}.${action.name}Tool`)) {
			const resource = String(n.parameters.resource ?? 'message');
			if (!optionValues(resourceProp).includes(resource)) problems.push(`${n.name}: resource "${resource}"`);
			const opProp = action.properties.find(
				(p) => p.name === 'operation' && (p.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
			);
			const operation = String(n.parameters.operation ?? opProp?.default);
			if (!optionValues(opProp).includes(operation)) problems.push(`${n.name}: operation "${resource}.${operation}"`);
			for (const key of Object.keys(n.parameters)) {
				if (!names.has(key) && !TOOL_ONLY_PARAMS.has(key)) problems.push(`${n.name}: unknown parameter "${key}"`);
			}
		}
		for (const n of wf.nodes.filter((x) => x.type === `${PKG}.${trigger.name}`)) {
			const valid = new Set(EVENT_OPTIONS.map((e) => e.value));
			for (const e of (n.parameters.events as string[] | undefined) ?? []) if (!valid.has(e)) problems.push(`${n.name}: event "${e}"`);
		}
		expect(problems).toEqual([]);
	});

	it('reads only fields the SocialMate Trigger actually emits', () => {
		const problems: string[] = [];
		for (const n of wf.nodes) {
			for (const s of strings(n.parameters)) {
				if (!s.startsWith('=')) continue;
				// $('Node Name').item.json.a.b.c
				for (const m of s.matchAll(/\$\(\s*['"]([^'"]+)['"]\s*\)\.(?:item|first\(\)|last\(\))\.json((?:\.[A-Za-z_$][\w$]*)+)/g)) {
					const ref = byName.get(m[1]);
					if (!ref) {
						problems.push(`${n.name}: references missing node "${m[1]}"`);
						continue;
					}
					if (!isMessageTrigger(ref)) continue;
					const miss = missingSegment(MESSAGE_RECEIVED_PAYLOAD, m[2].slice(1).split('.'));
					if (miss) problems.push(`${n.name}: $('${m[1]}').item.json.${m[2].slice(1)} — no "${miss}" in the Trigger output`);
				}
				// $json.a.b when this node is fed directly by a message Trigger
				const parents = mainParents(wf, n.name);
				if (parents.length === 1 && isMessageTrigger(parents[0])) {
					for (const m of s.matchAll(/\$json((?:\.[A-Za-z_$][\w$]*)+)/g)) {
						const miss = missingSegment(MESSAGE_RECEIVED_PAYLOAD, m[1].slice(1).split('.'));
						if (miss) problems.push(`${n.name}: $json.${m[1].slice(1)} — no "${miss}" in the Trigger output`);
					}
				}
			}
		}
		expect(problems).toEqual([]);
	});
});

/**
 * CORE_TYPES is a hand-kept list. When an n8n install is reachable (the global
 * one next to this Node binary, or N8N_NODE_MODULES=<n8n>/node_modules), check
 * every core node an example uses against the node manifests n8n ships — the
 * type must exist and the example's typeVersion must be one it accepts.
 * Skipped (not failed) on machines without n8n, e.g. CI.
 */
const N8N_MODULES = process.env.N8N_NODE_MODULES ?? join(dirname(process.execPath), '..', 'lib', 'node_modules', 'n8n', 'node_modules');
const MANIFESTS: Array<[pkg: string, file: string]> = [
	['n8n-nodes-base', join(N8N_MODULES, 'n8n-nodes-base', 'dist', 'types', 'nodes.json')],
	['@n8n/n8n-nodes-langchain', join(N8N_MODULES, '@n8n', 'n8n-nodes-langchain', 'dist', 'types', 'nodes.json')],
];
const haveN8n = MANIFESTS.every(([, m]) => existsSync(m));

describe.skipIf(!haveN8n)('examples — against the installed n8n', () => {
	it('every core node type and typeVersion exists in n8n', () => {
		const versions = new Map<string, number[]>();
		for (const [pkg, m] of MANIFESTS) {
			for (const d of JSON.parse(readFileSync(m, 'utf8')) as Array<{ name: string; version: number | number[] }>) {
				// The manifests list bare names ("webhook"); workflows use "<package>.<name>".
				const type = d.name.includes('.') ? d.name : `${pkg}.${d.name}`;
				versions.set(type, [...(versions.get(type) ?? []), ...([] as number[]).concat(d.version)]);
			}
		}
		const bad: string[] = [];
		for (const t of CORE_TYPES) if (!versions.has(t)) bad.push(`CORE_TYPES lists ${t}, which n8n does not have`);
		for (const file of files) {
			for (const n of load(file).nodes.filter((x) => CORE_TYPES.has(x.type))) {
				if (!versions.get(n.type)?.includes(n.typeVersion ?? 1)) bad.push(`${file}: ${n.name} ${n.type} v${n.typeVersion}`);
			}
		}
		expect(bad).toEqual([]);
	});
});

describe('examples — the validator itself', () => {
	it('would catch the bugs it was written for', () => {
		expect(missingSegment(MESSAGE_RECEIVED_PAYLOAD, ['body', 'data', 'chatId'])).toBe('body');
		expect(missingSegment(MESSAGE_RECEIVED_PAYLOAD, ['data', 'chatId'])).toBeNull();
		expect(PACKAGE_TYPES.has(`${PKG}.socialMateTool`)).toBe(true);
		expect(files.length).toBeGreaterThanOrEqual(10);
	});
});
