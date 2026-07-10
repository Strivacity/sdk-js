import { withAuthGuard } from '@strivacity/sdk-react';
import { Session } from '../components/profile/Session';

export default withAuthGuard(function Profile() {
	return (
		<>
			<Session />
		</>
	);
});
