// Stub for the '#strivacity-options-stateStorage' virtual alias, aliased in vite.config.mts (see
// app.ts for why). Kept as its own file rather than sharing one file across all four
// '#strivacity-options-*' aliases - vitest's mock registry keys mocks by resolved module id, so
// two different specifiers pointing at the same physical file collide when a test vi.mock()s one
// of them. Mirrors ./runtime/utils/noop's default shape.
export default function () {
	return undefined;
}
