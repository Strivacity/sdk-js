import StrivacityClient from './StrivacityClient';
import { StrivacityClientOptions } from './types';

export default function createStrivacityClient(options: StrivacityClientOptions): StrivacityClient {
	return new StrivacityClient(options);
}

export { StrivacityClient };
