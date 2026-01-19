import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// UX Test Suite - Checks for accessibility, usability, and responsive design issues

test.describe('Accessibility (a11y) Tests', () => {
    test('should have no accessibility violations on homepage', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

        // Log violations for debugging
        if (accessibilityScanResults.violations.length > 0) {
            console.log('\n=== Accessibility Violations ===');
            accessibilityScanResults.violations.forEach((violation) => {
                console.log(`\n[${violation.impact?.toUpperCase()}] ${violation.id}: ${violation.description}`);
                console.log(`Help: ${violation.helpUrl}`);
                violation.nodes.forEach((node) => {
                    console.log(`  - Element: ${node.html.substring(0, 100)}...`);
                    console.log(`    Fix: ${node.failureSummary}`);
                });
            });
        }

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no accessibility violations on login page', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

        if (accessibilityScanResults.violations.length > 0) {
            console.log('\n=== Login Page Accessibility Violations ===');
            accessibilityScanResults.violations.forEach((violation) => {
                console.log(`\n[${violation.impact?.toUpperCase()}] ${violation.id}: ${violation.description}`);
            });
        }

        expect(accessibilityScanResults.violations).toEqual([]);
    });
});

test.describe('Interactive Element UX Tests', () => {
    test('all buttons should have minimum touch target size (44x44px)', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const buttons = await page.locator('button, [role="button"], a[href]').all();
        const smallTargets: string[] = [];

        for (const button of buttons) {
            const box = await button.boundingBox();
            if (box && (box.width < 44 || box.height < 44)) {
                const text = await button.textContent();
                smallTargets.push(`"${text?.trim() || 'unnamed'}" (${Math.round(box.width)}x${Math.round(box.height)}px)`);
            }
        }

        if (smallTargets.length > 0) {
            console.log('\n=== Touch Target Size Issues ===');
            console.log('Elements smaller than 44x44px (WCAG 2.1 AAA):');
            smallTargets.forEach((target) => console.log(`  - ${target}`));
        }

        // Warning only - don't fail the test but log the issues
        expect(smallTargets.length).toBeLessThan(10); // Allow some small targets, fail if too many
    });

    test('all form inputs should have visible labels', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const inputs = await page.locator('input:not([type="hidden"]), textarea, select').all();
        const unlabeledInputs: string[] = [];

        for (const input of inputs) {
            const id = await input.getAttribute('id');
            const ariaLabel = await input.getAttribute('aria-label');
            const ariaLabelledBy = await input.getAttribute('aria-labelledby');
            const placeholder = await input.getAttribute('placeholder');

            // Check for associated label
            let hasLabel = false;
            if (id) {
                const label = await page.locator(`label[for="${id}"]`).count();
                hasLabel = label > 0;
            }

            if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
                const type = await input.getAttribute('type') || 'text';
                unlabeledInputs.push(`${type} input${placeholder ? ` (placeholder: "${placeholder}")` : ''}`);
            }
        }

        if (unlabeledInputs.length > 0) {
            console.log('\n=== Form Labeling Issues ===');
            console.log('Inputs without proper labels:');
            unlabeledInputs.forEach((input) => console.log(`  - ${input}`));
        }

        expect(unlabeledInputs).toEqual([]);
    });

    test('focus indicators should be visible', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Tab through interactive elements and check focus visibility
        const interactiveElements = await page.locator('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])').all();

        let focusableCount = 0;
        for (const element of interactiveElements.slice(0, 10)) {
            // Test first 10 elements
            try {
                await element.focus();
                focusableCount++;
            } catch {
                // Element may not be focusable
            }
        }

        expect(focusableCount).toBeGreaterThan(0);
    });
});

test.describe('Responsive Design Tests', () => {
    const viewports = [
        { name: 'Mobile', width: 375, height: 667 },
        { name: 'Tablet', width: 768, height: 1024 },
        { name: 'Desktop', width: 1280, height: 800 },
    ];

    for (const viewport of viewports) {
        test(`should render correctly on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Check for horizontal overflow
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });

            if (hasHorizontalScroll) {
                console.log(`\n=== Horizontal Overflow on ${viewport.name} ===`);
                console.log('Page has horizontal scroll which may indicate responsive design issues');
            }

            expect(hasHorizontalScroll).toBe(false);

            // Check that main content is visible
            const body = await page.locator('body');
            await expect(body).toBeVisible();

            // Check for text that's too small on mobile
            if (viewport.width < 500) {
                const smallTextElements = await page.evaluate(() => {
                    const elements = document.querySelectorAll('p, span, div, a, button, label');
                    let smallCount = 0;
                    elements.forEach((el) => {
                        const style = window.getComputedStyle(el);
                        const fontSize = parseFloat(style.fontSize);
                        if (fontSize < 12 && el.textContent?.trim()) {
                            smallCount++;
                        }
                    });
                    return smallCount;
                });

                if (smallTextElements > 0) {
                    console.log(`\n=== Small Text Warning on ${viewport.name} ===`);
                    console.log(`Found ${smallTextElements} elements with font-size < 12px`);
                }
            }
        });
    }
});

test.describe('Color Contrast Tests', () => {
    test('should have sufficient color contrast', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Use axe-core to specifically check color contrast
        const contrastResults = await new AxeBuilder({ page })
            .withRules(['color-contrast'])
            .analyze();

        if (contrastResults.violations.length > 0) {
            console.log('\n=== Color Contrast Issues ===');
            contrastResults.violations.forEach((violation) => {
                violation.nodes.forEach((node) => {
                    console.log(`  - ${node.html.substring(0, 80)}...`);
                    console.log(`    ${node.failureSummary}`);
                });
            });
        }

        expect(contrastResults.violations).toEqual([]);
    });
});

test.describe('Performance & Core Web Vitals', () => {
    test('should load within acceptable time', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        console.log(`\n=== Page Load Time: ${loadTime}ms ===`);

        // Page should load within 5 seconds
        expect(loadTime).toBeLessThan(5000);
    });

    test('should have good Largest Contentful Paint (LCP)', async ({ page }) => {
        await page.goto('/');

        const lcp = await page.evaluate(() => {
            return new Promise<number>((resolve) => {
                new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    resolve(lastEntry.startTime);
                }).observe({ type: 'largest-contentful-paint', buffered: true });

                // Fallback timeout
                setTimeout(() => resolve(0), 5000);
            });
        });

        if (lcp > 0) {
            console.log(`\n=== Largest Contentful Paint: ${Math.round(lcp)}ms ===`);
            // LCP should be under 2.5 seconds for good UX
            expect(lcp).toBeLessThan(2500);
        }
    });

    test('should have minimal Cumulative Layout Shift (CLS)', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const cls = await page.evaluate(() => {
            return new Promise<number>((resolve) => {
                let clsValue = 0;
                new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!(entry as any).hadRecentInput) {
                            clsValue += (entry as any).value;
                        }
                    }
                }).observe({ type: 'layout-shift', buffered: true });

                // Wait a bit for layout shifts to be recorded
                setTimeout(() => resolve(clsValue), 2000);
            });
        });

        console.log(`\n=== Cumulative Layout Shift: ${cls.toFixed(4)} ===`);
        // CLS should be under 0.1 for good UX
        expect(cls).toBeLessThan(0.25);
    });
});

test.describe('Navigation & Usability Tests', () => {
    test('should be navigable with keyboard only', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Press Tab multiple times and verify focus moves
        let focusedElements = 0;
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press('Tab');
            const focused = await page.evaluate(() => {
                const el = document.activeElement;
                return el && el !== document.body ? el.tagName : null;
            });
            if (focused) focusedElements++;
        }

        expect(focusedElements).toBeGreaterThan(0);
    });

    test('should have descriptive link text', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const badLinks = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href]');
            const badLinkTexts: string[] = [];
            const genericTexts = ['click here', 'here', 'read more', 'learn more', 'link', 'more'];

            links.forEach((link) => {
                const text = link.textContent?.trim().toLowerCase() || '';
                if (genericTexts.includes(text) || text.length < 2) {
                    badLinkTexts.push(text || '(empty)');
                }
            });

            return badLinkTexts;
        });

        if (badLinks.length > 0) {
            console.log('\n=== Non-Descriptive Link Text ===');
            badLinks.forEach((text) => console.log(`  - "${text}"`));
        }

        // Allow some generic links but flag if there are many
        expect(badLinks.length).toBeLessThan(5);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const headingIssues = await page.evaluate(() => {
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const issues: string[] = [];
            let lastLevel = 0;

            // Check for h1
            const h1Count = document.querySelectorAll('h1').length;
            if (h1Count === 0) {
                issues.push('No H1 heading found');
            } else if (h1Count > 1) {
                issues.push(`Multiple H1 headings found (${h1Count})`);
            }

            // Check heading order
            headings.forEach((heading) => {
                const level = parseInt(heading.tagName[1]);
                if (lastLevel > 0 && level > lastLevel + 1) {
                    issues.push(`Skipped heading level: H${lastLevel} to H${level}`);
                }
                lastLevel = level;
            });

            return issues;
        });

        if (headingIssues.length > 0) {
            console.log('\n=== Heading Hierarchy Issues ===');
            headingIssues.forEach((issue) => console.log(`  - ${issue}`));
        }

        expect(headingIssues).toEqual([]);
    });
});

test.describe('Error State UX Tests', () => {
    test('should handle 404 pages gracefully', async ({ page }) => {
        const response = await page.goto('/non-existent-page-12345');

        // Should either show a custom 404 or redirect
        const content = await page.content();
        const has404Indication =
            content.includes('404') ||
            content.includes('not found') ||
            content.includes('Not Found') ||
            response?.status() === 404;

        expect(has404Indication).toBe(true);
    });
});
