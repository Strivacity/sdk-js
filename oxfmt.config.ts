import { defineConfig } from 'oxfmt';

export default defineConfig({
	htmlWhitespaceSensitivity: 'ignore',
	ignorePatterns: [
		'.angular/',
		'.cache/',
		'.github/',
		'.nitro/',
		'.nuxt/',
		'.nx/',
		'.output/',
		'.pnpm-store/',
		'.svelte-kit/',
		'coverage/',
		'dist/',
		'node_modules/',
		'reports/',
		'packages/**/CHANGELOG.md',
		'packages/**/README.md',
		'pnpm-lock.yaml',
		'pnpm-workspace.yaml',
	],
});
