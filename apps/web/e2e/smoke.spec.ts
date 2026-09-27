import { expect, test } from '@playwright/test';

test.describe('Granisafe smoke (Phase 9)', () => {
  test('guard can open access kiosk and identify EMP-1001', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('guard@granisafe.local');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/app/);
    await page.goto('/app/access');
    await expect(page.getByRole('heading', { name: 'Access Control' })).toBeVisible();

    await page.getByRole('button', { name: 'EMP-1001' }).first().click();
    await page.getByRole('button', { name: 'Identify', exact: true }).click();

    await expect(page.getByText('EMP-1001')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Required PPE/i)).toBeVisible();

    // Simulate path avoids webcam / YOLO flakiness in CI
    await page.getByLabel('Detection mode').selectOption('simulate');
    await page.getByLabel('Simulated scenario').selectOption({ label: 'All PPE present' });
    await page.getByRole('button', { name: /Capture & run PPE inspect/i }).click();

    await expect(page.getByText(/Access granted|Access denied|GRANTED|DENIED/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('admin can open settings', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@granisafe.local');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Access cooldown (seconds)')).toBeVisible({
      timeout: 15_000,
    });
  });
});
