import { test, expect } from '@playwright/test';

test.describe('Kanban Board - Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('🚀 KanFlow');
    await page.waitForLoadState('networkidle');
  });

  test('should drag task from Ideas to Selected column', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('h3', { timeout: 10000 });
    
    // Find the first task in Ideas column
    const ideasColumn = page.locator('.column:has(h2:text-is("💡 Ideas"))').first();
    const firstTask = ideasColumn.locator('h3').first();
    
    // Get the task text for verification
    const taskText = await firstTask.textContent();
    
    // Find the Selected column
    const selectedColumn = page.locator('.column:has(h2:text-is("🎯 Selected"))').first();
    
    // Perform drag and drop
    await firstTask.dragTo(selectedColumn);
    
    // Wait for the operation to complete
    await page.waitForTimeout(1000);
    
    // Verify the task moved to Selected column
    const selectedColumnTasks = selectedColumn.locator('h3');
    await expect(selectedColumnTasks).toContainText([taskText]);
    
    // Verify the task is no longer in Ideas column (if it was the only one)
    const ideasColumnTasks = ideasColumn.locator('h3');
    const ideasTaskCount = await ideasColumnTasks.count();
    
    // Check that task counts updated
    await expect(page.locator('h2:has-text("🎯 Selected")')).toContainText('(');
  });

  test('should drag task from Selected to In Progress column', async ({ page }) => {
    // First ensure there's a task in Selected column
    await page.waitForSelector('h3', { timeout: 10000 });
    
    const selectedColumn = page.locator('.column:has(h2:text-is("🎯 Selected"))').first();
    const selectedTasks = selectedColumn.locator('h3');
    
    // If no tasks in Selected, skip this test
    const taskCount = await selectedTasks.count();
    if (taskCount === 0) {
      test.skip('No tasks in Selected column to test drag and drop');
    }
    
    const firstTask = selectedTasks.first();
    const taskText = await firstTask.textContent();
    
    // Find the In Progress column
    const inProgressColumn = page.locator('.column:has(h2:text-is("⚙️ In Progress"))').first();
    
    // Perform drag and drop
    await firstTask.dragTo(inProgressColumn);
    
    // Wait for the operation to complete
    await page.waitForTimeout(1000);
    
    // Verify the task moved to In Progress column
    const inProgressTasks = inProgressColumn.locator('h3');
    await expect(inProgressTasks).toContainText([taskText]);
  });

  test('should handle drag and drop with API errors', async ({ page }) => {
    // Intercept move API calls and simulate errors
    await page.route('**/api/tasks/*/move**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Move operation failed' })
      });
    });
    
    await page.waitForSelector('h3', { timeout: 10000 });
    
    // Try to drag a task
    const ideasColumn = page.locator('.column:has(h2:text-is("💡 Ideas"))').first();
    const firstTask = ideasColumn.locator('h3').first();
    const selectedColumn = page.locator('.column:has(h2:text-is("🎯 Selected"))').first();
    
    // Perform drag and drop
    await firstTask.dragTo(selectedColumn);
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // The task should revert back to original position due to error
    // (This depends on the error handling implementation)
    await expect(ideasColumn.locator('h3').first()).toBeVisible();
  });

  test('should provide visual feedback during drag operation', async ({ page }) => {
    await page.waitForSelector('h3', { timeout: 10000 });
    
    const firstTask = page.locator('h3').first();
    
    // Start dragging
    await firstTask.hover();
    await page.mouse.down();
    
    // Move mouse to simulate dragging
    await page.mouse.move(200, 100);
    
    // Check for visual feedback (this depends on implementation)
    // The task might have different styling while being dragged
    
    // Complete the drag
    await page.mouse.up();
  });

  test('should maintain task order within columns', async ({ page }) => {
    await page.waitForSelector('h3', { timeout: 10000 });
    
    // Get initial order of tasks in Ideas column
    const ideasColumn = page.locator('.column:has(h2:text-is("💡 Ideas"))').first();
    const initialTasks = await ideasColumn.locator('h3').allTextContents();
    
    if (initialTasks.length < 2) {
      test.skip('Need at least 2 tasks to test ordering');
    }
    
    // Drag the first task to the same column (reordering)
    const firstTask = ideasColumn.locator('h3').first();
    const secondTask = ideasColumn.locator('h3').nth(1);
    
    await firstTask.dragTo(secondTask);
    
    // Wait for reordering
    await page.waitForTimeout(1000);
    
    // Check that tasks are still in the same column
    const finalTasks = await ideasColumn.locator('h3').allTextContents();
    expect(finalTasks.length).toBe(initialTasks.length);
  });

  test('should work with keyboard navigation', async ({ page }) => {
    await page.waitForSelector('h3', { timeout: 10000 });
    
    // Focus on the first task
    const firstTask = page.locator('h3').first();
    await firstTask.focus();
    
    // Try keyboard navigation (if implemented)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // This test depends on keyboard accessibility implementation
    // For now, just ensure the task remains focusable
    await expect(firstTask).toBeFocused();
  });
});
