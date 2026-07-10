import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
	const origin = request.headers.get('origin') ?? '';
	const response = NextResponse.next();

	response.headers.set('Access-Control-Allow-Credentials', 'true');
	response.headers.set('Access-Control-Allow-Origin', origin);
	response.headers.set('Access-Control-Expose-Headers', 'content-length,content-range,x-event-id');

	return response;
}

export const config = {
	matcher: '/auth/:path*',
};
