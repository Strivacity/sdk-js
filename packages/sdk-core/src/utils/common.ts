/**
 * Returns the current Unix timestamp (seconds since the epoch).
 *
 * @returns {number} The current timestamp in seconds.
 */
export function timestamp(): number {
	return Math.floor(Date.now() / 1000);
}

/**
 * Unflattens a flat object with dot-separated keys into a nested object.
 *
 * @param flatObject - The flat object to unflatten.
 * @returns The nested object.
 */
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
