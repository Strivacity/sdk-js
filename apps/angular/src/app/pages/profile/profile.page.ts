import { Component, inject } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { SessionComponent } from '../../components/profile/session';

@Component({
	selector: 'app-profile-page',
	templateUrl: './profile.page.html',
	imports: [SessionComponent],
})
export class ProfilePage {}
