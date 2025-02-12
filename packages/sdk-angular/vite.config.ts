import { defineConfig } from 'vite';
import angularPlugin from '@analogjs/vite-plugin-angular';

export default defineConfig({
	plugins: [angularPlugin()],
});
