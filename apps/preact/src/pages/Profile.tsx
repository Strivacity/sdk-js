import { withAuthGuard } from '@strivacity/sdk-preact';
import { Session } from '../components/profile/Session';

export default withAuthGuard(function Profile() {
	return (
		<>
			<Session />
		</>
	);
});
