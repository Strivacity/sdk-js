import type { Provider } from '@angular/core';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/**
 * Provides `providers` at a throwaway standalone component's own injector (not the TestBed module injector), and
 * runs `read` synchronously during that component's construction, i.e. within its injection context - so `inject(...)`
 * calls inside `read` resolve services scoped to that component. This is what makes `fixture.destroy()` actually fire
 * `DestroyRef.onDestroy` callbacks registered by those services: a service provided at the TestBed module level lives
 * in the root environment injector, which `fixture.destroy()` never tears down.
 */
export function mountWithProviders<T>(providers: Provider[], read: () => T): { value: T; destroy: () => void } {
	let value!: T;

	@Component({ selector: 'test-host', template: '', standalone: true, providers })
	class TestHostComponent {
		constructor() {
			value = read();
		}
	}

	const fixture = TestBed.createComponent(TestHostComponent);
	fixture.detectChanges();

	return { value, destroy: () => fixture.destroy() };
}
