import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import App from '@demo/angular';
import { showRepositoryLink } from '../version';
import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';

showRepositoryLink(true);
void bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] }).catch((error: unknown) => {
  window.reportError(error);
});
