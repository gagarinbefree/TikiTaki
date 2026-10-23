import { createApp } from 'vue';
import { DEMO_TEXT } from '../config';
import App from './App.vue';
import { metrics } from './metrics';
import { showDeploymentVersion } from '../version';
import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';

void showDeploymentVersion();
const app = createApp(App);
app.config.errorHandler = metrics.error;
app.mount(DEMO_TEXT.appSelector);
