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
	`chromedriver` version in `package.json` and run `npm install`). See the `scripts/` helpers.

If you want, I can add a `npm run ci` helper or make the report template fancier.

