import {inject} from './assets/vercel-analytics.js';

const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
inject({mode: local ? 'development' : 'production', debug: false});
