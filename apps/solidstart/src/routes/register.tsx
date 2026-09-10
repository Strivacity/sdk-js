import { modes } from '../components/auth';
import { sdkOptions } from '../options';

export default function Register() {
	const ModeComponent = modes[sdkOptions.mode ?? 'redirect'] ?? modes.redirect;

	return <ModeComponent flowType="register" />;
}
