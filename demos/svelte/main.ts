import { mount } from 'svelte';
import { DEMO_TEXT } from '../config';
import { showRepositoryLink } from '../version';
import App from './App.svelte';
import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';

void showRepositoryLink();
const target = document.getElementById(DEMO_TEXT.app);
if (!target) throw new Error(DEMO_TEXT.missingDemoRoot);
mount(App, { target });
