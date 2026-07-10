'use client';

import { withAuthGuard } from '@strivacity/sdk-next/client';
import { Session } from '../../components/profile/Session';

export default withAuthGuard(function ProfilePage() {
	return (
		<>
			<Session />
		</>
	);
});
