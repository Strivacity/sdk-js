import { modes } from '../components/auth';
import { sdkOptions } from '../options';

export default function Login() {
	const ModeComponent = modes[sdkOptions.mode ?? 'redirect'] ?? modes.redirect;

	return <ModeComponent flowType="login" />;
}
