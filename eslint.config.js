import tsEslint from 'typescript-eslint';
import pluginJs from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
// import nxAngular from '@nx/eslint-plugin-angular';
// import angularEslint from '@angular-eslint/eslint-plugin';
// import angularTemplateEslint from '@angular-eslint/eslint-plugin-template';

export default tsEslint.config(
	pluginJs.configs.recommended,
	...tsEslint.configs.recommended,
	...pluginVue.configs['flat/recommended'],
	...vueTsEslintConfig({ extends: ['recommended'] }),
	{
		ignores: ['**/dist', '**/reports', '**/coverages', '**/node_modules', '**/.angular', '**/.next', '**/.nuxt', '**/.output'],
	},
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.browser,
			},
		},
		rules: {
			'no-console': 'error',
			'no-empty': ['error', { allowEmptyCatch: true }],
			'no-eq-null': 'error',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
	{
		files: ['**/*.{jsx,tsx}'],
		plugins: {
			pluginReact,
			pluginReactHooks,
		},
		languageOptions: {
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.browser,
			},
		},
		rules: {
			'react-hooks/exhaustive-deps': 'off',
		},
	},
	{
		files: ['**/*.vue'],
		rules: {
			'vue/html-indent': ['error', 'tab'],
			'vue/attribute-hyphenation': 'off',
			'vue/multi-word-component-names': 'off',
			'vue/singleline-html-element-content-newline': 'off',
			'vue/multiline-html-element-content-newline': 'off',
			'vue/max-attributes-per-line': [
				'error',
				{
					singleline: { max: 10 },
					multiline: { max: 1 },
				},
			],
		},
	},
	// {
	// 	files: ['packages/sdk-angular/**/*.ts', 'apps/sdk-angular-app/**/*.ts'],
	// 	plugins: {
	// 		nxAngular,
	// 		angularEslint,
	// 	},
	// 	rules: {
	// 		'@typescript-eslint/no-explicit-any': 'warn',
	// 		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
	// 		'@angular-eslint/directive-selector': [
	// 			'error',
	// 			{
	// 				type: 'attribute',
	// 				prefix: 'app',
	// 				style: 'camelCase',
	// 			},
	// 		],
	// 		'@angular-eslint/component-selector': [
	// 			'error',
	// 			{
	// 				type: 'element',
	// 				prefix: 'app',
	// 				style: 'kebab-case',
	// 			},
	// 		],
	// 	},
	// },
	// {
	// 	files: ['packages/sdk-angular/**/*.html'],
	// 	plugins: {
	// 		angularTemplateEslint,
	// 	},
	// },
);
