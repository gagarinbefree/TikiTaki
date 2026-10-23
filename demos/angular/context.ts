import { InjectionToken } from '@angular/core';
import { DEMO_TEXT } from '../config';
/** Parent injector context retained by every embedded cell view. */
export const DEMO_CONTEXT = new InjectionToken<string>(DEMO_TEXT.context);
