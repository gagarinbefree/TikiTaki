import { createApp } from 'vue';
import { DEMO_TEXT } from '../config';
import App from './App.vue';
import { metrics } from './metrics';
import { showRepositoryLink } from '../version';
import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';

showRepositoryLink();
const app = createApp(App);
app.config.errorHandler = metrics.error;
app.mount(DEMO_TEXT.appSelector);
