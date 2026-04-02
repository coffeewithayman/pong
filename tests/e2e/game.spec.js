const { test, expect } = require('@playwright/test');

// Each test gets fresh browser contexts, but shares the server.
// Tests must be serial to avoid interfering with each other.
test.describe.serial('Game Lifecycle', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/test/reset');
    // Wait for reset to propagate
    await new Promise((r) => setTimeout(r, 500));
  });

  test('two players can join and start a game', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');
    await page2.goto('/');

    // Player 1 joins
    await page1.fill('#name-input', 'Alice');
    await page1.click('#join-btn');

    // Player 2 joins
    await page2.fill('#name-input', 'Bob');
    await page2.click('#join-btn');

    // Wait for game to start
    await expect(page1.locator('#game-container')).toHaveClass(/active/);
    await expect(page2.locator('#game-container')).toHaveClass(/active/);

    // Both should get your-turn status
    await expect(page1.locator('#status-text')).toContainText('Your turn');
    await expect(page2.locator('#status-text')).toContainText('Your turn');

    // Canvas should be visible
    await expect(page1.locator('#game-canvas')).toBeVisible();

    // Wait for game loop to send a few state frames
    await page1.waitForTimeout(500);

    // Canvas must have non-zero internal dimensions (not just CSS size)
    const canvasInfo = await page1.evaluate(() => {
      const c = document.getElementById('game-canvas');
      return { width: c.width, height: c.height };
    });
    expect(canvasInfo.width).toBeGreaterThan(0);
    expect(canvasInfo.height).toBeGreaterThan(0);

    // Canvas must have non-black pixels (paddles/ball are actually drawn)
    const hasVisibleContent = await page1.evaluate(() => {
      const c = document.getElementById('game-canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) return true;
      }
      return false;
    });
    expect(hasVisibleContent).toBe(true);

    // Close contexts to free player slots for next test
    await ctx1.close();
    await ctx2.close();

  });

  test('third player is queued when two are playing', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.fill('#name-input', 'Dan');
    await page1.click('#join-btn');

    // Wait for first player to be assigned
    await expect(page1.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });

    await page2.fill('#name-input', 'Eve');
    await page2.click('#join-btn');
    await expect(page2.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });

    // Third player joins
    await page3.goto('/');
    await page3.fill('#name-input', 'Frank');
    await page3.click('#join-btn');
    await expect(page3.locator('#status-text')).toContainText('queue', { timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();

  });

  test('eliminated player is replaced by queued player via force-score', async ({ browser, request }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.fill('#name-input', 'Gina');
    await page1.click('#join-btn');
    await page2.fill('#name-input', 'Hank');
    await page2.click('#join-btn');

    await expect(page1.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });
    await expect(page2.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });

    // Queue third player
    await page3.goto('/');
    await page3.fill('#name-input', 'Ivy');
    await page3.click('#join-btn');
    await expect(page3.locator('#status-text')).toContainText('queue', { timeout: 5000 });

    // Force score: left scores, right (Hank) loses
    await request.post('/test/score', { data: { side: 'left' } });

    // Hank should be eliminated
    await expect(page2.locator('#status-text')).toContainText('Eliminated', { timeout: 5000 });

    // Ivy should get a turn after the pause
    await expect(page3.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();

  });

  test('leaderboard updates after elimination', async ({ browser, request }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.fill('#name-input', 'Jack');
    await page1.click('#join-btn');
    await page2.fill('#name-input', 'Kate');
    await page2.click('#join-btn');

    await expect(page1.locator('#status-text')).toContainText('Your turn', { timeout: 5000 });

    // Force score: left scores, Kate eliminated
    await request.post('/test/score', { data: { side: 'left' } });

    // Wait for leaderboard update
    await page1.waitForTimeout(1000);

    // Open leaderboard
    await page1.click('#leaderboard-toggle');
    await expect(page1.locator('#leaderboard-panel')).not.toHaveClass(/hidden/);

    // Leaderboard should have Kate's entry
    await expect(page1.locator('#leaderboard-body')).toContainText('Kate');

    await ctx1.close();
    await ctx2.close();
  });
});
