import { type ServerRoute, RenderMode } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
	{
		path: '**',
		renderMode: RenderMode.Server,
	},
];
