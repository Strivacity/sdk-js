#!/usr/bin/env node
/**
 * Deterministic, offline checks for the `strivacity` agent skill (plugins/strivacity/skills/strivacity).
 *
 * 1. SKILL.md frontmatter has the required fields.
 * 2. Every intent in the Step 1 table has a `### <intent>` section in Step 4, and vice versa.
 * 3. Reachability: every route in Step 4 (expanded over the covered frameworks and the modes) points at an existing
 *    references/<name>/index.md, and every reference directory is reachable from SKILL.md.
 * 4. Reference files are sinks: no relative links to other .md files.
 * 5. Routing cases (evals/skill/routing-cases.json): the route Step 4 computes for each case equals `expect_refs`.
 *
 * Run: node evals/skill/check-skill.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const skillDir = join(root, 'plugins', 'strivacity', 'skills', 'strivacity');
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
const cases = JSON.parse(readFileSync(join(root, 'evals', 'skill', 'routing-cases.json'), 'utf8')).cases;
const errors = [];

function section(heading) {
	const start = skill.indexOf(`## ${heading}`);

	if (start === -1) {
		errors.push(`SKILL.md: missing "## ${heading}" section`);
		return '';
	}

	const end = skill.indexOf('\n## ', start + 1);

	return skill.slice(start, end === -1 ? undefined : end);
}

function tableRows(text) {
	return text
		.split('\n')
		.filter((line) => line.startsWith('|') && !/^\|\s*-/.test(line))
		.slice(1)
		.map((line) =>
			line
				.split('|')
				.slice(1, -1)
				.map((cell) => cell.trim()),
		);
}

// 1. Frontmatter
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';

for (const field of ['name:', 'description:', 'license:', 'author:']) {
	if (!frontmatter.includes(field)) {
		errors.push(`SKILL.md frontmatter: missing ${field}`);
	}
}

// Value sets
const intents = tableRows(section('Step 1')).map((row) => row[1].replace(/\*/g, ''));
const frameworks = tableRows(section('Step 2'))
	.filter((row) => row[3] === 'Yes')
	.map((row) => row[1].replace(/`/g, ''));
const modes = tableRows(section('Step 3')).map((row) => row[1].replace(/`/g, ''));

// Step 4 routes: { intent: [{ gate: string | null, ref: string }] }
const routes = {};

for (const match of section('Step 4').matchAll(/^### (\S+)\n+```\n([\s\S]*?)```/gm)) {
	routes[match[1]] = match[2]
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const parsed = line.match(/^(?:If ([^:]+): )?Read: references\/([^/]+)\/index\.md$/);

			if (!parsed) {
				errors.push(`SKILL.md Step 4 (${match[1]}): unrecognised line "${line}"`);
				return null;
			}

			return { gate: parsed[1] ?? null, ref: parsed[2] };
		})
		.filter(Boolean);
}

// 2. Intents <-> sections
for (const intent of intents) {
	if (!routes[intent]) errors.push(`SKILL.md: intent "${intent}" has no "### ${intent}" section in Step 4`);
}
for (const intent of Object.keys(routes)) {
	if (!intents.includes(intent)) errors.push(`SKILL.md: Step 4 section "${intent}" is not an intent in Step 1`);
}

// 3. Reachability
const expand = (ref) =>
	frameworks.flatMap((framework) => modes.map((mode) => ref.replace('{framework}', framework).replace('{mode}', mode))).filter((v, i, a) => a.indexOf(v) === i);
const reachable = new Set(Object.values(routes).flatMap((list) => list.flatMap(({ ref }) => expand(ref))));
const referenceDirs = readdirSync(join(skillDir, 'references'), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

for (const ref of reachable) {
	if (!existsSync(join(skillDir, 'references', ref, 'index.md'))) errors.push(`route points at missing file: references/${ref}/index.md`);
}
for (const dir of referenceDirs) {
	if (!reachable.has(dir)) errors.push(`references/${dir}/ is not reachable from SKILL.md`);
}

// 4. Sinks
for (const dir of referenceDirs) {
	const file = join(skillDir, 'references', dir, 'index.md');

	if (!existsSync(file)) continue;

	for (const link of readFileSync(file, 'utf8').matchAll(/\]\((?!https?:\/\/)([^)]*\.md[^)]*)\)/g)) {
		errors.push(`references/${dir}/index.md links to another .md file: ${link[1]}`);
	}
}

// 5. Routing cases
for (const testCase of cases) {
	const list = routes[testCase.intent];

	if (!list) {
		errors.push(`case ${testCase.id}: unknown intent "${testCase.intent}"`);
		continue;
	}

	const gates = {
		'server-session': Boolean(testCase.server_session),
		'framework covered': frameworks.includes(testCase.framework),
		'mode known': Boolean(testCase.mode),
	};
	const actual = list
		.filter(({ gate }) => gate === null || gates[gate])
		.map(({ ref }) => `${ref.replace('{framework}', testCase.framework).replace('{mode}', testCase.mode)}/index.md`)
		.sort();
	const expected = [...testCase.expect_refs].sort();

	for (const { gate } of list) {
		if (gate !== null && !(gate in gates)) errors.push(`case ${testCase.id}: unmodelled gate "${gate}"`);
	}
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		errors.push(`case ${testCase.id}: expected [${expected.join(', ')}] but Step 4 routes to [${actual.join(', ')}]`);
	}
}

if (errors.length) {
	console.error(`✗ strivacity skill: ${errors.length} problem(s)\n${errors.map((e) => `  - ${e}`).join('\n')}`);
	process.exit(1);
}

console.log(`✓ strivacity skill: ${referenceDirs.length} references reachable, ${cases.length} routing cases pass`);
