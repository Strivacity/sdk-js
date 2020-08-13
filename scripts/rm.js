const { argv, cwd } = require('process');
const { resolve } = require('path');
const { existsSync, emptyDirSync } = require('fs-extra');

(function () {
	const resolvedPath = resolve(cwd(), argv.slice(2)[0]);

	if (existsSync(resolvedPath)) {
		emptyDirSync(resolvedPath);
	}
})();
