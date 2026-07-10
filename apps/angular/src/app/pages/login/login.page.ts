import { Component } from '@angular/core';
import { AuthLoginComponent } from '../../components/auth';

@Component({
	selector: 'app-login-page',
	template: '<app-auth-login flowType="login" />',
	imports: [AuthLoginComponent],
})
export class LoginPage {}
