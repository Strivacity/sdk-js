import type { Plugin } from 'vite';

/**
 * Preserve 'use client' / 'use server' directives in bundled output.
 * Rollup strips these bare string expressions; we re-inject them as banners.
 */
export function preserveDirectivesPlugin(): Plugin {
	const directiveMap = new Map<string, string>();

	return {
		name: 'preserve-directives',
		transform(code, id) {
			const match = code.match(/^(['"])use (client|server)\1\s*;?\n/);

			if (match) {
				directiveMap.set(id, match[0].trim());
			}

			return null;
		},
		renderChunk(code, chunk) {
			const directives = new Set<string>();

			for (const id of Object.keys(chunk.modules)) {
				const directive = directiveMap.get(id);

				if (directive) {
					directives.add(directive);
				}
			}

			if (directives.size === 0) {
				return null;
			}

			return { code: [...directives].join('\n') + '\n' + code };
		},
	};
}
