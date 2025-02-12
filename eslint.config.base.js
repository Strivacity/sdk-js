import pluginJs from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import tsEslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export const baseConfig = {
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
		parserOptions: {
			projectService: true,
			tsconfigRootDir: import.meta.dirname,
		},
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
		'@typescript-eslint/prefer-promise-reject-errors': 'off',
		'@typescript-eslint/no-redundant-type-constituents': 'off',
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		'@typescript-eslint/no-unsafe-argument': 'off',
		'@typescript-eslint/no-unsafe-assignment': 'off',
		'@typescript-eslint/no-unsafe-call': 'off',
		'@typescript-eslint/no-unsafe-member-access': 'off',
		'@typescript-eslint/no-unsafe-return': 'off',
	},
};

export const ignoreConfig = {
	ignores: ['.stylelintrc.js', 'eslint.config.js', 'vite.config.ts', 'vitest.config.ts', '**/dist', '**/reports'],
};

export const defineTsConfig = (...configs) =>
	tsEslint.config(pluginJs.configs.recommended, ...tsEslint.configs.recommendedTypeChecked, ignoreConfig, baseConfig, ...configs);

export const defineAngularConfig = (...configs) =>
	tsEslint.config(pluginJs.configs.recommended, ...tsEslint.configs.recommendedTypeChecked, ignoreConfig, baseConfig, ...configs);

export const defineReactConfig = (...configs) =>
	tsEslint.config(
		pluginJs.configs.recommended,
		...tsEslint.configs.recommendedTypeChecked,
		ignoreConfig,
		baseConfig,
		{
			files: ['**/*.{jsx,tsx}'],
			plugins: {
				pluginReact,
				pluginReactHooks,
			},
			languageOptions: {
				ecmaVersion: 2022,
				sourceType: 'module',
				parserOptions: {
					projectService: true,
					tsconfigRootDir: import.meta.dirname,
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
		...configs,
	);

export const defineVueConfig = (...configs) =>
	defineConfigWithVueTs(
		pluginJs.configs.recommended,
		...pluginVue.configs['flat/recommended'],
		vueTsConfigs.recommendedTypeChecked,
		ignoreConfig,
		baseConfig,
		{
			files: ['**/*.vue'],
			rules: {
				'vue/html-indent': ['error', 'tab'],
				'vue/no-v-html': 'off',
				'vue/html-self-closing': 'off',
				'vue/no-deprecated-slot-attribute': 'off',
				'vue/singleline-html-element-content-newline': 'off',
				'vue/multiline-html-element-content-newline': 'off',
				'vue/attribute-hyphenation': 'off',
				'vue/multi-word-component-names': 'off',
				'vue/html-closing-bracket-spacing': 'error',
				'vue/component-definition-name-casing': ['error', 'kebab-case'],
				'vue/max-attributes-per-line': ['error', { singleline: { max: 10 }, multiline: { max: 1 } }],
			},
		},
		...configs,
	);
