export interface StrivacityClientOptions {
	timeout?: number;
	url: string;
}

export interface Consent {
	id?: string;
	createdAt?: string;
	format: string;
	iab: {
		receipt: string;
	};
}

export interface Attribute {
	familyName: string;
	givenName: string;
	email: string;
}

export interface Identity {
	id?: string;
	createdAt?: string;
	attributes: Attribute;
}
