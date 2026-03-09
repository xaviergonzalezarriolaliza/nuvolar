import chrome from 'selenium-webdriver/chrome';
import { Builder, until, logging } from 'selenium-webdriver';
import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import chromedriver from 'chromedriver';
import http from 'http';

async function run() {
  console.log('Starting Selenium test');
  const options = new chrome.Options();
  // Choose headless in CI (GitHub Actions) and non-headless locally
  const isCI = !!(process.env.GITHUB_ACTIONS || process.env.CI);
  if (isCI) {
    options.addArguments('--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage');
    console.log('Running in CI/headless mode');
  } else {
    // Run non-headless so the browser window opens for debugging
    options.addArguments('--disable-gpu', '--start-maximized', '--window-size=1280,800');
  }

  // Enable verbose chromedriver service logging and set logging preferences
  const logPath = path.join(process.cwd(), 'chromedriver.log');

  // Spawn chromedriver ourselves with verbose logging when running locally.
  // In CI we prefer to let Selenium Manager or the runner provide the browser driver.
  let cdProc: ChildProcessWithoutNullStreams | null = null;
  async function waitForStatus(url = 'http://127.0.0.1:9515/status', timeout = 15000) {
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
      (function poll() {
        http.get(url, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) return resolve();
          if (Date.now() - start > timeout) return reject(new Error('Timed out waiting for chromedriver status'));
          setTimeout(poll, 250);
        }).on('error', () => {
          if (Date.now() - start > timeout) return reject(new Error('Timed out waiting for chromedriver status'));
          setTimeout(poll, 250);
        });
      })();
    });
  }

  if (!isCI) {
    const cdArgs = [`--port=9515`, `--verbose`, `--log-path=${logPath}`];
    cdProc = spawn(chromedriver.path, cdArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    cdProc.stdout.on('data', (d) => process.stdout.write(`[chromedriver stdout] ${d}`));
    cdProc.stderr.on('data', (d) => process.stderr.write(`[chromedriver stderr] ${d}`));
  } else {
    console.log('CI detected: not spawning chromedriver, using Selenium Manager / runner-provided driver');
  }

  // Build logging preferences (browser + driver)
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
  prefs.setLevel(logging.Type.DRIVER, logging.Level.ALL);

  function escapeHtml(s: string) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  // Pass logging prefs via capabilities so driver emits detailed logs
  // Wait for chromedriver to be ready, then point WebDriver to it
  // Simple report object
  const report: any = {
    startTime: new Date().toISOString(),
    success: false,
  };

  if (cdProc) {
    try {
      await waitForStatus();
      console.log('chromedriver is ready on port 9515');
    } catch (e) {
      console.error('chromedriver did not start in time:', (e as any)?.message || e);
      try {
        cdProc.kill();
      } catch {}
      throw e;
    }
  }

  // When running in CI, do not point to a local chromedriver server; let Selenium Manager
  // or the runner provide the driver. Locally we connect to the spawned chromedriver.
  const builder = new Builder().forBrowser('chrome').setChromeOptions(options).setLoggingPrefs(prefs as any);
  if (cdProc) builder.usingServer('http://127.0.0.1:9515');
  const driver = await builder.build();

  try {
    const startTs = Date.now();
    console.log('Navigating to https://www.google.com');
    await driver.get('https://www.google.com');
    console.log('Navigated, waiting for title');
    await driver.wait(until.titleContains('Google'), 30000);
    const title = await driver.getTitle();
    console.log('Page title is:', title);

    // Ensure screenshots directory exists
    const shotsDir = path.join(process.cwd(), 'screenshots');
    await fs.mkdir(shotsDir, { recursive: true });

    // Save a screenshot on success
    try {
      const img = await driver.takeScreenshot();
      const outFile = path.join(shotsDir, `success-${Date.now()}.png`);
      await fs.writeFile(outFile, Buffer.from(img, 'base64'));
      console.log('Saved success screenshot to', outFile);
      report.screenshot = outFile;
      report.title = title;
      report.success = true;
      report.durationMs = Date.now() - startTs;
    } catch (sErr) {
      console.warn('Failed to save success screenshot:', (sErr as any)?.message || sErr);
    }

    console.log('Test completed successfully');
  } catch (err: any) {
    console.error('Test failed inside run():', err);
    // Attempt to capture a screenshot on failure
    try {
      const shotsDir = path.join(process.cwd(), 'screenshots');
      await fs.mkdir(shotsDir, { recursive: true });
      const img = await driver.takeScreenshot();
      const outFile = path.join(shotsDir, `failure-${Date.now()}.png`);
      await fs.writeFile(outFile, Buffer.from(img, 'base64'));
      console.log('Saved failure screenshot to', outFile);
      report.screenshot = outFile;
      report.success = false;
      report.error = (err as any)?.message || String(err);
    } catch (sErr) {
      console.warn('Failed to capture failure screenshot:', (sErr as any)?.message || sErr);
    }
    throw err;
  } finally {
    await driver.quit();

    // Kill chromedriver process if we spawned one
    if (cdProc) {
      try {
        cdProc.kill();
      } catch (e) {
        /* ignore */
      }

      // Attempt to read chromedriver log and print last portion for debugging
      try {
        const data = await fs.readFile(logPath, 'utf8');
        console.log('--- chromedriver.log (last 2000 chars) ---');
        console.log(data.slice(-2000));
        report.chromedriverLogTail = data.slice(-2000);
      } catch (e: any) {
        console.warn('Could not read chromedriver log:', e?.message || e);
      }
    } else {
      report.chromedriverLogTail = '';
    }

    // Ensure reports directory and write an HTML report
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      const reportPath = path.join(reportsDir, `report-${Date.now()}.html`);

      const screenshotRel = report.screenshot ? path.relative(reportsDir, report.screenshot).replace(/\\/g, '/') : '';
      const cdLogHtml = report.chromedriverLogTail ? `<pre>${escapeHtml(report.chromedriverLogTail)}</pre>` : '';

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Selenium Test Report</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>pre.log{background:#f8f9fa;border:1px solid #e9ecef;padding:12px;overflow:auto;max-height:360px}</style>
  </head>
  <body class="p-4">
    <div class="container">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h3">Selenium Test Report</h1>
        <span class="badge ${report.success ? 'bg-success' : 'bg-danger'}">${report.success ? 'PASS' : 'FAIL'}</span>
      </div>

      <div class="row">
        <div class="col-lg-8">
          <ul class="list-group mb-3">
            <li class="list-group-item"><strong>Start:</strong> ${escapeHtml(report.startTime)}</li>
            <li class="list-group-item"><strong>Title:</strong> ${escapeHtml(report.title || '')}</li>
            <li class="list-group-item"><strong>Duration (ms):</strong> ${report.durationMs || ''}</li>
            ${report.error ? `<li class="list-group-item text-danger"><strong>Error:</strong> ${escapeHtml(report.error)}</li>` : ''}
          </ul>

          <h5>ChromeDriver Log (tail)</h5>
          ${cdLogHtml || '<p class="text-muted">(no log available)</p>'}
        </div>

        <div class="col-lg-4">
          ${screenshotRel ? `<div class="card"><div class="card-body"><h6 class="card-title">Screenshot</h6><img src="${escapeHtml(screenshotRel)}" class="img-fluid"/></div></div>` : '<p class="text-muted">No screenshot</p>'}
        </div>
      </div>

      <footer class="mt-4 text-muted small">Generated by Selenium test</footer>
    </div>
  </body>
</html>`;

      await fs.writeFile(reportPath, html, 'utf8');
      console.log('Wrote HTML test report to', reportPath);
    } catch (e: any) {
      console.warn('Failed to write HTML test report:', e?.message || e);
    }
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
