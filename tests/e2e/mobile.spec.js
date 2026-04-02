const { test, expect } = require('@playwright/test');

test.describe('Mobile Controls', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/test/reset');
    await new Promise((r) => setTimeout(r, 500));
  });

  test('mobile control buttons are visible on small screens', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await ctx.newPage();

    await page.goto('/');
    await page.fill('#name-input', 'MobilePlayer');
    await page.click('#join-btn');

    await expect(page.locator('#game-container')).toHaveClass(/active/);
    await expect(page.locator('#mobile-controls')).toBeVisible();
    await expect(page.locator('#btn-up')).toBeVisible();
    await expect(page.locator('#btn-down')).toBeVisible();

    await ctx.close();
  });

  test('touch controls send input events', async ({ browser }) => {
    const ctx1 = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true });
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.fill('#name-input', 'MobileP');
    await page1.click('#join-btn');
    await page2.fill('#name-input', 'DesktopP');
    await page2.click('#join-btn');

    await expect(page1.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });

    // Tap the up button
    await page1.locator('#btn-up').tap();
    await page1.waitForTimeout(200);

    // Tap the down button
    await page1.locator('#btn-down').tap();
    await page1.waitForTimeout(200);

    // Game should still be running
    await expect(page1.locator('#game-canvas')).toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });

  test('mobile controls are hidden on desktop viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();

    await page.goto('/');
    await page.fill('#name-input', 'DesktopUser');
    await page.click('#join-btn');

    await expect(page.locator('#game-container')).toHaveClass(/active/);
    await expect(page.locator('#mobile-controls')).not.toBeVisible();

    await ctx.close();
  });
});
