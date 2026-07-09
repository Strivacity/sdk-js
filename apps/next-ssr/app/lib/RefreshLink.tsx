'use client';

import { usePathname } from 'next/navigation';

export function RefreshLink({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
	const pathname = usePathname();

	return (
		<a href={`/auth/refresh?returnTo=${encodeURIComponent(pathname)}`} {...props}>
			{children}
		</a>
	);
}
