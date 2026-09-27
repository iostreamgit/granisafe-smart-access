import { expect, test } from '@playwright/test';

test.describe('RBAC UI smoke (Phase 9)', () => {
  test('employee cannot open settings or access kiosk', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('employee@granisafe.local');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
    await expect(page.getByText(/Access cooldown/i)).toHaveCount(0);

    await page.goto('/app/access');
    await expect(page.getByRole('heading', { name: 'Access Control' })).toHaveCount(0);
  });

  test('hr can open reports page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('hr@granisafe.local');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

    await page.goto('/app/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Generate' })).toBeVisible();
  });
});
