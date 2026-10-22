import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cacheRoot } from './local-cache.mjs';
// Set before Playwright initializes its registry. Revisions/platform are selected
// by the locked playwright-core package, never by a per-stage copy.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(cacheRoot, 'playwright');
const playwright = await import('playwright-core');
export const { chromium, firefox, webkit, _electron } = playwright;
// A run must never overwrite a previous screenshot/report with a fixed filename.
export const artifactRoot = process.env.DSH_TEST_ARTIFACTS ?? join(cacheRoot, '..', 'artifacts', 'runs', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID());
