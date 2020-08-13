import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

const footer = `('StrivacityClient' in this) && this.console && this.console.warn && this.console.warn('StrivacityClient already declared on the global namespace');
this && this.createStrivacityClient && (this.StrivacityClient = this.StrivacityClient || this.createStrivacityClient.StrivacityClient);`;

/** @type {import('rollup').RollupOptions[]} */
let bundles = [
	{
		input: 'src/index.ts',
		output: {
			file: 'dist/index.esm.js',
			format: 'esm',
			exports: 'named',
		},
		plugins: [
			typescript({
				declarationDir: 'dist',
				tsconfigOverride: {
					compilerOptions: {
						outDir: 'dist',
						declaration: true,
					},
				},
			}),
			terser(),
		],
	},
	{
		input: 'src/index.cjs.ts',
		output: {
			file: 'dist/index.cjs.js',
			format: 'cjs',
			exports: 'named',
		},
		plugins: [
			typescript(),
			terser(),
		],
	},
	{
		input: 'src/index.cjs.ts',
		output: {
			name: 'createStrivacityClient',
			file: 'dist/index.umd.js',
			footer,
			format: 'umd',
		},
		plugins: [
			typescript(),
			terser(),
		],
	},
];

export default bundles;
