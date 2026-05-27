import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
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
