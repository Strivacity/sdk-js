import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import angularPlugin from '@analogjs/vite-plugin-angular';

export default defineConfig({
	plugins: [nxViteTsPaths(), angularPlugin()],
});
