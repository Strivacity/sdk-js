declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace globalThis {
		// eslint-disable-next-line no-var
		var litIssuedWarnings: Set<string> | undefined;
	}
}

// Disable specific Lit warnings by adding their identifiers to this set.
globalThis.litIssuedWarnings ??= new Set();
globalThis.litIssuedWarnings.add('dev-mode');
