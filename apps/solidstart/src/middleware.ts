import type { FetchMiddleware } from '@solidjs/web';
import { getServerSdk } from './server/strivacity';

const middleware: FetchMiddleware = async (request, next) => {
	const serverSdk = getServerSdk();

	return serverSdk.middleware(request, next);
};

export default middleware;
