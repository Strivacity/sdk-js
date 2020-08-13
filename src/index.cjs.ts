import createStrivacityClient, { StrivacityClient } from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrapper = createStrivacityClient as any;

wrapper.StrivacityClient = StrivacityClient;
wrapper.createStrivacityClient = createStrivacityClient;

export default wrapper;
