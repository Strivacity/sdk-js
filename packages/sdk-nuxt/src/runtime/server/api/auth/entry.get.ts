import { defineEventHandler } from 'h3';

export default defineEventHandler((event) => event.context.strivacity.sdk.handleEntry(event));
