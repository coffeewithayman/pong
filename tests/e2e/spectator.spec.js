const { test, expect } = require('@playwright/test');

test.describe('Spectator', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/test/reset');
    await new Promise((r) => setTimeout(r, 500));
  });

  test('spectator sees the game canvas after joining', async ({ page }) => {
    await page.goto('/');

    await page.fill('#name-input', 'Spectator');
    await page.click('#join-btn');

    await expect(page.locator('#game-container')).toHaveClass(/active/);
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('spectator is queued when two players are already playing', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctxSpec = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const pageSpec = await ctxSpec.newPage();

    await page1.goto('/');
    await page2.goto('/');

    // Two players join first
    await page1.fill('#name-input', 'SP1');
    await page1.click('#join-btn');
    await expect(page1.locator('#status-text')).toContainText(/Your turn|Waiting/, { timeout: 5000 });

    await page2.fill('#name-input', 'SP2');
    await page2.click('#join-btn');

    // Wait for game to start
    await expect(page1.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });
    await expect(page2.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });

    // Now spectator joins - should be queued
    await pageSpec.goto('/');
    await pageSpec.fill('#name-input', 'Watcher');
    await pageSpec.click('#join-btn');

    await expect(pageSpec.locator('#status-text')).toContainText('queue', { timeout: 5000 });
    await expect(pageSpec.locator('#game-canvas')).toBeVisible();

    await ctx1.close();
    await ctx2.close();
    await ctxSpec.close();
  });
});
