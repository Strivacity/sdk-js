module.exports = {
	testMatch: [
		'<rootDir>/**/*.spec.ts',
	],
	testPathIgnorePatterns: [
		'<rootDir>/node_modules/',
		'<rootDir>/dist/',
	],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
	},
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	moduleFileExtensions: ['js', 'json', 'ts'],
	collectCoverage: true,
	coverageReporters: ['html', 'cobertura'],
	reporters: [
		'default',
		['jest-junit', { outputDirectory: './reports/unit' }],
	],
	coverageDirectory: 'reports/unit',
	coveragePathIgnorePatterns: ['<rootDir>/tests/unit'],
};
