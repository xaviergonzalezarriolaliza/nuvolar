# nuvolar

TypeScript Selenium sample

Setup

1. Install dependencies:

```bash
npm install
```

2. Run the test:

```bash
npm run start
```

Notes

- This sample uses `selenium-webdriver` and the `chromedriver` npm package.
- Ensure a compatible Chrome browser is installed. If Chrome is not on the default path, configure ChromeOptions accordingly.
- For CI or headless runs, add `options.headless()` to the Chrome options in `src/simpleTest.ts`.

What I changed to make it work

- **Added** a minimal TypeScript Selenium test at `src/simpleTest.ts` that starts ChromeDriver,
	runs a simple navigation to https://www.google.com, takes a screenshot and produces a report.
- **Added** `package.json` and `tsconfig.json` so the project can install and run with `npm`.
- **Pinned** `chromedriver` (major 145) to match the local Chrome install used during development.
- **Improved** the test to: spawn a verbose `chromedriver` process (writes `chromedriver.log`),
	wait for it to be ready, toggle headless mode automatically when running under CI (`CI` or
	`GITHUB_ACTIONS` env), capture screenshots to `screenshots/`, and write an HTML report to `reports/`.
- **Added** a GitHub Actions workflow at `.github/workflows/selenium.yml` that runs the test
	headless on `ubuntu-latest` and uploads `reports/**` and `screenshots/**` as artifacts.

Quick commands

```bash
npm install
npm run start   # run locally (non-headless by default)
```

CI notes

- Push to `main` (or open a PR) to trigger the `Selenium tests` workflow. The workflow runs headless
	and uploads the generated HTML report and screenshots as artifacts.
- If the job fails due to a Chrome/Chromedriver mismatch, update Chrome (or pin a matching

- The repository was recently adjusted to address CI failures seen when the runner did not
	contain a packaged `chromedriver` binary. Key changes made during troubleshooting:
	- Start script: the `start` script was changed to run Node and register `ts-node` from
		JavaScript (avoids executing the `ts-node` binary directly in GitHub Actions which
		produced a "Permission denied" error on some runners).
	- Chromedriver spawn: `src/simpleTest.ts` now checks candidate binary paths before
		attempting to spawn `chromedriver` (checks `chromedriver.path`, `/usr/bin/chromedriver`,
		`/usr/local/bin/chromedriver`). If no binary is found the test will *not* spawn a local
		driver and will instead let Selenium Manager or the runner provide the driver. This avoids
		ENOENT errors when the packaged binary is missing on CI.
	- Workflow updates: the GitHub Actions workflow was updated during iteration (Node 20 and
		an optional runner step to install a system `chromium-chromedriver`) so CI can provide a
		matching driver when needed. If your CI environment lacks a chromedriver binary, prefer
		installing one on the runner or pinning a compatible `chromedriver` version in `package.json`.

