export function unflattenObject(flatObject: Record<string, unknown>): Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const nestedObject: Record<string, any> = {};

	for (const key in flatObject) {
		const keys = key.split('.');

		keys.reduce((acc, part, index) => {
			if (index === keys.length - 1) {
				acc[part] = flatObject[key];
			} else {
				acc[part] = acc[part] || {};
			}

			return acc[part];
		}, nestedObject);
	}

	return nestedObject;
}
