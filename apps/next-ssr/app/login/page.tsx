import { sdk } from '../lib/auth/server';
import { EmbeddedLogin } from './EmbeddedLogin';

export default sdk.withLoginSession((params) => {
	return <EmbeddedLogin {...params} />;
});
