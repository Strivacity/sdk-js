const indentConfig = {
	'SwitchCase': 1,
	'VariableDeclarator': 1,
	'outerIIFEBody': 1,
	'MemberExpression': 1,
	'FunctionDeclaration': {
		'parameters': 1,
		'body': 1,
	},
	'FunctionExpression': {
		'parameters': 1,
		'body': 1,
	},
	'CallExpression': {
		'arguments': 1,
	},
	'ArrayExpression': 1,
	'ObjectExpression': 1,
	'ImportDeclaration': 1,
	'flatTernaryExpressions': false,
	'ignoreComments': false,
};

module.exports = {
	env: {
		browser: true,
		node: true,
		es6: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		warnOnUnsupportedTypeScriptVersion: false,
		createDefaultProgram: true,
		project: './tsconfig.eslint.json',
	},
	extends: [
		'eslint:recommended',
	],
	rules: {
		'no-console': 'error',
		'no-debugger': 'error',
		'no-empty': ['error', { 'allowEmptyCatch': true }],
		'arrow-parens': ['error', 'always'],
		'operator-linebreak': ['error', 'before'],
		'space-before-function-paren': ['error', { 'anonymous': 'always', 'named': 'never' }],
		'comma-dangle': ['error', 'always-multiline'],
		'eol-last': 'error',
		'indent': ['error', 'tab', indentConfig],
		'no-tabs': 'off',
		'linebreak-style': ['error', 'unix'],
		'no-underscore-dangle': 'off',
		'semi': ['error', 'always'],
		'strict': 'off',
		'object-curly-spacing': ['error', 'always'],
		'keyword-spacing': [
			'error',
			{
				'overrides': {
					'else': { 'before': true },
					'while': { 'before': true },
					'catch': { 'before': true },
				},
			},
		],
		'quote-props': ['error', 'consistent'],
		'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
		'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
		'no-prototype-builtins': 'off',
		'no-eq-null': 'error',
		'no-multiple-empty-lines': ['error', { 'max': 1 }],
		'newline-after-var': [2, 'always'],
		'prefer-promise-reject-errors': ['error', { 'allowEmptyReject': true }],
	},
	overrides: [
		{
			files: ['*.ts', '*.tsx'],
			extends: [
				'plugin:@typescript-eslint/recommended',
				'plugin:@typescript-eslint/recommended-requiring-type-checking',
			],
			rules: {
				'no-unused-vars': 'off',
				'quotes': 'off',
				'indent': 'off',
				'@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
				'@typescript-eslint/no-var-requires': 'error',
				'@typescript-eslint/quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
				'@typescript-eslint/indent': ['error', 'tab', indentConfig],
				'@typescript-eslint/unbound-method': ['error', { 'ignoreStatic': true }],
				'@typescript-eslint/no-unnecessary-type-assertion': 'off',
				'@typescript-eslint/no-unsafe-assignment': 'off',
				'@typescript-eslint/no-unsafe-call': 'off',
				'@typescript-eslint/no-unsafe-member-access': 'off',
				'@typescript-eslint/no-unsafe-return': 'off',
				'@typescript-eslint/explicit-module-boundary-types': 'off',
				'@typescript-eslint/explicit-function-return-type': ['error', {
					'allowExpressions': true,
					'allowTypedFunctionExpressions': true,
					'allowHigherOrderFunctions': true,
				}],
				'@typescript-eslint/restrict-template-expressions': ['error', {
					'allowAny': true,
				}],
			},
		},
	],
};
