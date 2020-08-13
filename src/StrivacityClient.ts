import { StrivacityClientOptions } from './types';
import AnonymousIdentity from './anonymousIdentity';

export default class StrivacityClient {
	public anonymousIdentity: AnonymousIdentity;

	constructor(options: StrivacityClientOptions) {
		if (!options.url) {
			throw new Error('StrivacityClient :: url must be provided');
		}

		this.anonymousIdentity = new AnonymousIdentity(options);
	}
}
