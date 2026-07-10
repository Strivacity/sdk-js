import { Component } from '@angular/core';
import { AuthLoginComponent } from '../../components/auth';

@Component({
	selector: 'app-register-page',
	template: '<app-auth-login flowType="register" />',
	imports: [AuthLoginComponent],
})
export class RegisterPage {}
