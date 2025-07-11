import { test, expect } from '@playwright/test';

test.describe('Kanban Board - Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('🚀 KanFlow');
  });

  test('should display the kanban board with all columns', async ({ page }) => {
    // Check that all columns are present
    await expect(page.locator('h2')).toContainText(['💡 Ideas', '🎯 Selected', '⚙️ In Progress', '🅿️ Parked', '✅ Done']);
    
    // Check that task counts are displayed
    await expect(page.locator('h2:has-text("💡 Ideas")')).toContainText('(');
    await expect(page.locator('h2:has-text("🎯 Selected")')).toContainText('(');
  });

  test('should load and display existing tasks', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForLoadState('networkidle');
    
    // Check that tasks are displayed in Ideas column
    const ideasColumn = page.locator('[data-testid="column-ideas"], .column:has(h2:text-is("💡 Ideas"))').first();
    await expect(ideasColumn).toBeVisible();
    
    // Check for task content (should have sample tasks)
    const taskCards = page.locator('h3');
    await expect(taskCards.first()).toBeVisible();
  });

  test('should open task creation modal when add button is clicked', async ({ page }) => {
    // Click the add button for Ideas column
    const addButton = page.locator('button[aria-label*="Add new task to 💡 Ideas"], button:has-text("Add new task")').first();
    await addButton.click();
    
    // Check that modal is opened
    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
    
    // Check modal content
    await expect(page.locator('input[placeholder*="title"], input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea, [data-testid="description"]')).toBeVisible();
  });

  test('should create a new task', async ({ page }) => {
    // Click add button for Ideas column
    const addButton = page.locator('button[aria-label*="Add new task to 💡 Ideas"], button:has-text("Add new task")').first();
    await addButton.click();
    
    // Fill in task details
    await page.fill('input[placeholder*="title"], input[name="title"]', 'Test Task from E2E');
    await page.fill('textarea, [data-testid="description"]', 'This is a test task created by Playwright');
    
    // Save the task
    await page.click('button:has-text("Save"), button:has-text("Create")');
    
    // Wait for modal to close
    await expect(page.locator('[role="dialog"], .modal')).not.toBeVisible();
    
    // Check that the new task appears in the Ideas column
    await expect(page.locator('h3:has-text("Test Task from E2E")')).toBeVisible();
  });

  test('should open settings modal', async ({ page }) => {
    // Click settings button
    await page.click('button[aria-label*="Settings"], button:has-text("Settings")');
    
    // Check that settings modal is opened
    await expect(page.locator('[role="dialog"]:has-text("Settings"), .modal:has-text("Settings")')).toBeVisible();
    
    // Check for settings tabs
    await expect(page.locator('button:has-text("General"), .tab:has-text("General")')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API calls and simulate errors
    await page.route('**/api/tasks**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // Reload the page to trigger the error
    await page.reload();
    
    // Check that the application doesn't crash and shows empty state
    await expect(page.locator('h1')).toContainText('🚀 KanFlow');
    
    // Check that columns show (0) tasks when API fails
    await expect(page.locator('h2:has-text("💡 Ideas")')).toContainText('(0)');
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that the application is still functional
    await expect(page.locator('h1')).toContainText('🚀 KanFlow');
    
    // Check that columns are visible (might be stacked on mobile)
    await expect(page.locator('h2:has-text("💡 Ideas")')).toBeVisible();
    await expect(page.locator('h2:has-text("🎯 Selected")')).toBeVisible();
  });

  test('should maintain state after page refresh', async ({ page }) => {
    // Create a task first
    const addButton = page.locator('button[aria-label*="Add new task to 💡 Ideas"], button:has-text("Add new task")').first();
    await addButton.click();
    
    await page.fill('input[placeholder*="title"], input[name="title"]', 'Persistent Test Task');
    await page.fill('textarea, [data-testid="description"]', 'This task should persist after refresh');
    await page.click('button:has-text("Save"), button:has-text("Create")');
    
    // Wait for task to be created
    await expect(page.locator('h3:has-text("Persistent Test Task")')).toBeVisible();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check that the task is still there
    await expect(page.locator('h3:has-text("Persistent Test Task")')).toBeVisible();
  });
});
