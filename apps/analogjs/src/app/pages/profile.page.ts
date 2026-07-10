import { Component, inject } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { Router } from '@angular/router';
import { defineRouteMeta } from '@analogjs/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { authGuard } from '../guards/auth.guard';
import { SessionComponent } from '../components/profile/session';

export const routeMeta = defineRouteMeta({
	canActivate: [authGuard],
});

@Component({
	selector: 'app-profile-page',
	imports: [SessionComponent],
	template: `
		<section>
			<app-session></app-session>
		</section>
	`,
})
export default class ProfilePage {}
