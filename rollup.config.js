import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

const footer = `('StrivacityClient' in this) && this.console && this.console.warn && this.console.warn('StrivacityClient already declared on the global namespace');
this && this.createStrivacityClient && (this.StrivacityClient = this.StrivacityClient || this.createStrivacityClient.StrivacityClient);`;
const typescriptPlugin = (tsconfig) => typescript({
	tsconfig: tsconfig,
});
const terserPlugin = () => terser({
	output: { comments: false },
});

const esmBuild = {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.esm.js',
		format: 'esm',
		exports: 'named',
		sourcemap: true,
	},
	plugins: [
		typescriptPlugin('tsconfig.base.json'),
		terserPlugin(),
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
		typescriptPlugin('tsconfig.base.json'),
		terserPlugin(),
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
		typescriptPlugin('tsconfig.base.json'),
		terserPlugin(),
	],
};

export default [
	esmBuild,
	commonjsBuild,
	umdBuild,
];
