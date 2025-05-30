export default {
	ignoreFiles: ['**/*'],
	extends: ['stylelint-config-standard-scss', 'stylelint-config-html/html', 'stylelint-config-html/vue'],
	rules: {
		'scss/at-mixin-argumentless-call-parentheses': 'always',
		'scss/operator-no-newline-before': null,
		'scss/dollar-variable-colon-space-after': null,
		'at-rule-empty-line-before': null,
		'color-hex-length': 'long',
		'declaration-block-no-redundant-longhand-properties': [true, { ignoreShorthands: ['grid-template'] }],
		'declaration-empty-line-before': null,
		'no-descending-specificity': null,
		'rule-empty-line-before': null,
		'selector-not-notation': null,
		'value-keyword-case': ['lower', { camelCaseSvgKeywords: true }],
		'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['deep', 'global'] }],
	},
};
