import { defineAngularConfig } from '../../eslint.config.base.js';

export default defineAngularConfig(
	{
		ignores: ['webpack.config.cjs'],
	},
	{
		files: ['./src/**/*.ts'],
		extends: ['plugin:@nx/angular', 'plugin:@angular-eslint/template/process-inline-templates'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@angular-eslint/directive-selector': [
				'error',
				{
					type: 'attribute',
					prefix: 'app',
					style: 'camelCase',
				},
			],
			'@angular-eslint/component-selector': [
				'error',
				{
					type: 'element',
					prefix: 'app',
					style: 'kebab-case',
				},
			],
		},
	},
	{
		files: ['./src/**/*.html'],
		extends: ['plugin:@nx/angular-template'],
	},
);
