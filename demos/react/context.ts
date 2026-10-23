import { createContext } from 'react';
import { DEMO_TEXT } from '../config';
import { createMetrics } from '../shared';
/** Parent-root context retained by every cell portal. */
export const Context = createContext<string>(DEMO_TEXT.empty);
/** Lifecycle diagnostics for this demo application. */
export const metrics = createMetrics();
