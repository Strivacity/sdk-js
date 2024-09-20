import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-index')
export class IndexPage extends LitElement {
	render() {
		return html`
			<h1>Framework: web component</h1>
		`;
	}
}
