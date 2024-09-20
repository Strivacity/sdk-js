/**
 * Returns the current Unix timestamp (seconds since the epoch).
 *
 * @returns {number} The current timestamp in seconds.
 */
export function timestamp(): number {
	return Math.floor(Date.now() / 1000);
}
