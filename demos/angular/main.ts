import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import App from '@demo/angular';
import { showDeploymentVersion } from '../version';
import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';

void showDeploymentVersion();
void bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] }).catch((error: unknown) => {
  window.reportError(error);
});
