import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
	standalone: false,
	encapsulation: ViewEncapsulation.None,
	selector: 'app-loading-widget',
	templateUrl: './loading.widget.html',
	styleUrls: ['./loading.widget.scss'],
	host: {
		'data-loader': '',
		'data-widget': 'loading',
	},
})
export class LoadingWidget {
	@Input() diameter: number = 80;
	@Input() stroke: number = 2.5;
}
