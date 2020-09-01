import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

const footer = `('StrivacityClient' in this) && this.console && this.console.warn && this.console.warn('StrivacityClient already declared on the global namespace'); this && this.createStrivacityClient && (this.StrivacityClient = this.StrivacityClient || this.createStrivacityClient.StrivacityClient);`;

const esmBuild = {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.esm.js',
		format: 'esm',
		exports: 'named',
		sourcemap: true,
	},
	plugins: [
		typescript({
			tsconfig: 'tsconfig.base.json',
		}),
		terser({
			output: { comments: false },
		}),
	],
};
const commonjsBuild = {
	input: 'src/index.cjs.ts',
	output: {
		file: 'dist/index.cjs.js',
		format: 'cjs',
		exports: 'named',
		sourcemap: true,
	},
	plugins: [
		typescript({
			tsconfig: 'tsconfig.base.json',
		}),
		terser({
			output: { comments: false },
		}),
	],
};
const umdBuild = {
	input: 'src/index.cjs.ts',
	output: {
		name: 'createStrivacityClient',
		file: 'dist/index.umd.js',
		format: 'umd',
		sourcemap: true,
		footer,
	},
	plugins: [
		typescript({
			tsconfig: 'tsconfig.base.json',
		}),
		terser({
			output: { comments: false },
		}),
	],
};
const legacyBuild = {
	input: 'src/index.cjs.ts',
	output: {
		name: 'createStrivacityClient',
		file: 'dist/index.legacy.js',
		format: 'umd',
		sourcemap: true,
		footer,
	},
	plugins: [
		typescript({
			tsconfig: 'tsconfig.base.json',
			tsconfigOverride: {
				compilerOptions: {
					target: 'es5',
				},
			},
		}),
		terser({
			output: { comments: false },
		}),
	],
};

export default [
	esmBuild,
	commonjsBuild,
	umdBuild,
	legacyBuild,
];
