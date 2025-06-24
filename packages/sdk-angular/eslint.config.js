import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import { defineAngularConfig } from '../../eslint.config.base.js';

export default defineAngularConfig({
	files: ['./src/**/*.ts'],
	plugins: {
		'@angular-eslint': angular,
		'@angular-eslint/template': angularTemplate,
	},
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
});
