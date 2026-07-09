import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		environment: 'node',
		testTimeout: 15_000,
		// Integration tests start a real localhost HTTP server; keep them in one
		// process to avoid port churn and make request-count assertions reliable.
		pool: 'threads',
	},
});
