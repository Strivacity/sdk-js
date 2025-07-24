import React from 'react';
import './loading.widget.scss';

export function LoadingWidget({ diameter = 80, stroke = 2.5 }: { diameter?: number; stroke?: number }) {
	return (
		<div data-loader>
			<svg style={{ width: `${diameter}px`, height: `${diameter}px` }} viewBox="25 25 50 50" className="spinner" role="presentation" aria-hidden="true">
				<circle style={{ strokeWidth: `${stroke}px` }} cx="50" cy="50" r="20" className="circle"></circle>
			</svg>
		</div>
	);
}
