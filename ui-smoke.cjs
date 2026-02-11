const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const jwt = require('./backend/node_modules/jsonwebtoken');

async function main() {
  const root = process.cwd();
  const outDir = path.join(root, 'output', 'playwright');
  fs.mkdirSync(outDir, { recursive: true });

  const users = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'data', 'users.json'), 'utf8'));
  const serversData = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'data', 'servers.json'), 'utf8'));
  const user = users[0];
  const currentServerId = serversData.currentServerId || (serversData.servers && serversData.servers[0] && serversData.servers[0].id) || null;

  const token = jwt.sign(
    {
      id: user.id,
      username: user.user,
      role: user.role,
      permissions: user.permissions
    },
    'hytale-panel-secret-key-2026',
    { expiresIn: '24h' }
  );

  const localUser = {
    id: user.id,
    user: user.user,
    role: user.role,
    permissions: user.permissions,
    currentServerId,
    mustChangePassword: user.mustChangePassword || false
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const apiFailures = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('localhost:3000/api') && res.status() >= 400) {
      apiFailures.push({ url, status: res.status() });
    }
  });

  await page.addInitScript(({ token, localUser }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(localUser));
  }, { token, localUser });

  const routes = [
    { path: '/', name: 'dashboard' },
    { path: '/console', name: 'console' },
    { path: '/files', name: 'files' },
    { path: '/plugins', name: 'plugins' },
    { path: '/users', name: 'users' },
    { path: '/players', name: 'players' },
    { path: '/settings', name: 'settings' },
    { path: '/universes', name: 'universes' },
    { path: '/about', name: 'about' }
  ];

  const routeResults = [];

  for (const route of routes) {
    const url = `http://localhost:5173${route.path}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);

    const title = await page.locator('h1').first().textContent().catch(() => null);
    const bodyText = await page.locator('body').innerText();

    const hasLoadErrorText = /error|failed|could not load universes|access denied/i.test(bodyText);

    const shotPath = path.join(outDir, `${route.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    routeResults.push({
      route: route.path,
      name: route.name,
      url: page.url(),
      title: title ? title.trim() : null,
      hasLoadErrorText
    });
  }

  await browser.close();

  const summary = {
    routeResults,
    consoleErrors,
    pageErrors,
    apiFailures,
    screenshotsDir: outDir
  };

  fs.writeFileSync(path.join(outDir, 'ui-smoke-results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
