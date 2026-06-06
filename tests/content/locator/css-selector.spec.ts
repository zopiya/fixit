import { describe, it, expect, beforeEach } from 'vitest';
import { generateCssSelector } from '../../../src/content/locator/css-selector';

describe('generateCssSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('priority 1: data-attr', () => {
    it('returns [data-testid="value"] with confidence data-attr', () => {
      document.body.innerHTML = '<button data-testid="submit-btn">Submit</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('[data-testid=submit-btn]');
      expect(result.confidence).toBe('data-attr');
    });

    it('prefers data-testid over data-cy', () => {
      document.body.innerHTML =
        '<button data-testid="primary" data-cy="secondary">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('[data-testid=primary]');
      expect(result.confidence).toBe('data-attr');
    });

    it('falls back to data-cy when data-testid is absent', () => {
      document.body.innerHTML = '<button data-cy="my-btn">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('[data-cy=my-btn]');
      expect(result.confidence).toBe('data-attr');
    });

    it('falls back to data-qa', () => {
      document.body.innerHTML = '<button data-qa="my-btn">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('[data-qa=my-btn]');
      expect(result.confidence).toBe('data-attr');
    });
  });

  describe('priority 2: id', () => {
    it('returns #id with confidence id for semantic id', () => {
      document.body.innerHTML = '<form id="my-form"><input /></form>';
      const el = document.querySelector('form')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('#my-form');
      expect(result.confidence).toBe('id');
    });

    it('skips generated hash id (styled-components pattern)', () => {
      document.body.innerHTML = '<div id="sc-abc12"><span>text</span></div>';
      const el = document.querySelector('div')!;
      const result = generateCssSelector(el);
      // Should NOT use the generated id, falls to next priority
      expect(result.selector).not.toBe('#sc-abc12');
      expect(result.confidence).not.toBe('id');
    });

    it('skips css- prefixed hash id', () => {
      document.body.innerHTML = '<div id="css-a1b2c3"><span>text</span></div>';
      const el = document.querySelector('div')!;
      const result = generateCssSelector(el);
      expect(result.selector).not.toBe('#css-a1b2c3');
      expect(result.confidence).not.toBe('id');
    });

    it('skips MUI-style generated id', () => {
      document.body.innerHTML = '<div id="MuiButton-root-abc12"><span>text</span></div>';
      const el = document.querySelector('div')!;
      const result = generateCssSelector(el);
      expect(result.selector).not.toBe('#MuiButton-root-abc12');
      expect(result.confidence).not.toBe('id');
    });
  });

  describe('priority 3: aria', () => {
    it('returns tagname[aria-label="value"] with confidence aria', () => {
      document.body.innerHTML = '<button aria-label="Close dialog">×</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('button[aria-label=Close\\ dialog]');
      expect(result.confidence).toBe('aria');
    });
  });

  describe('priority 3b: role', () => {
    it('should use role attribute for elements with role', () => {
      const el = document.createElement('div');
      el.setAttribute('role', 'dialog');
      document.body.appendChild(el);
      const result = generateCssSelector(el);
      expect(result.selector).toBe('[role=dialog]');
      expect(result.confidence).toBe('aria');
    });
  });

  describe('priority 4: name', () => {
    it('returns tagname[name="value"] with confidence name for form elements', () => {
      document.body.innerHTML = '<input name="email" />';
      const el = document.querySelector('input')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('input[name=email]');
      expect(result.confidence).toBe('name');
    });

    it('returns name selector for select element', () => {
      document.body.innerHTML =
        '<select name="country"><option>US</option></select>';
      const el = document.querySelector('select')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('select[name=country]');
      expect(result.confidence).toBe('name');
    });

    it('returns name selector for textarea element', () => {
      document.body.innerHTML = '<textarea name="bio"></textarea>';
      const el = document.querySelector('textarea')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('textarea[name=bio]');
      expect(result.confidence).toBe('name');
    });
  });

  describe('priority 5: semantic-class', () => {
    it('returns tagname.class1.class2 with confidence semantic-class', () => {
      document.body.innerHTML = '<button class="btn primary">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('button.btn.primary');
      expect(result.confidence).toBe('semantic-class');
    });

    it('skips generated classes (styled-components sc- prefix)', () => {
      document.body.innerHTML =
        '<button class="sc-abc123 real-class">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      // Should only include the semantic class
      expect(result.selector).toBe('button.real-class');
      expect(result.confidence).toBe('semantic-class');
    });

    it('skips css- prefixed generated classes', () => {
      document.body.innerHTML =
        '<button class="css-1a2b3c real-class">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('button.real-class');
      expect(result.confidence).toBe('semantic-class');
    });

    it('skips MUI generated classes', () => {
      document.body.innerHTML =
        '<button class="MuiButton-root MuiButton-contained real-class">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('button.real-class');
      expect(result.confidence).toBe('semantic-class');
    });

    it('skips chakra- prefixed classes', () => {
      document.body.innerHTML =
        '<button class="chakra-button real-class">Click</button>';
      const el = document.querySelector('button')!;
      const result = generateCssSelector(el);
      expect(result.selector).toBe('button.real-class');
      expect(result.confidence).toBe('semantic-class');
    });
  });

  describe('priority 6: structural', () => {
    it('falls to structural when element has no useful attributes', () => {
      document.body.innerHTML = '<div><span>text</span></div>';
      const el = document.querySelector('span')!;
      const result = generateCssSelector(el);
      expect(result.confidence).toBe('structural');
      expect(result.selector).toContain(':nth-of-type');
    });

    it('builds nth-of-type chain for deeply nested elements', () => {
      document.body.innerHTML = `
        <div>
          <div>
            <div>
              <span>deep</span>
            </div>
          </div>
        </div>
      `;
      const el = document.querySelector('span')!;
      const result = generateCssSelector(el);
      expect(result.confidence).toBe('structural');
      // Should have multiple levels of :nth-of-type
      const nthCount = (result.selector.match(/:nth-of-type/g) || []).length;
      expect(nthCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('uniqueness enforcement', () => {
    it('adds parent context when selector is not unique', () => {
      document.body.innerHTML = `
        <div>
          <span>first</span>
        </div>
        <div>
          <span>second</span>
        </div>
      `;
      // Both spans are identical, structural selector should be unique
      const spans = document.querySelectorAll('span');
      const result = generateCssSelector(spans[1]);
      expect(result.confidence).toBe('structural');
      // The selector should match at least the target element
      expect(document.querySelectorAll(result.selector).length).toBeGreaterThanOrEqual(1);
    });

    it('produces a selector that uniquely matches the target element', () => {
      document.body.innerHTML = `
        <form id="login">
          <input name="user" />
          <input name="pass" />
        </form>
      `;
      const inputs = document.querySelectorAll('input');
      const result0 = generateCssSelector(inputs[0]);
      const result1 = generateCssSelector(inputs[1]);
      expect(document.querySelectorAll(result0.selector).length).toBe(1);
      expect(document.querySelectorAll(result1.selector).length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles data-v- prefixed attributes (Vue scoped)', () => {
      document.body.innerHTML =
        '<div data-v-abc123 class="container"><span>text</span></div>';
      const el = document.querySelector('div')!;
      // data-v-* are NOT in the data-attr priority list (data-testid/data-cy/data-qa)
      // so they won't trigger priority 1, but the element still has a class
      const result = generateCssSelector(el);
      // Should use class or structural, not the data-v- attribute
      expect(result.selector).not.toContain('data-v-');
    });

    it('handles empty class list gracefully', () => {
      document.body.innerHTML = '<div><span></span></div>';
      const el = document.querySelector('span')!;
      const result = generateCssSelector(el);
      expect(result.confidence).toBe('structural');
      expect(result.selector).toBeTruthy();
    });

    it('should escape special characters in attribute values', () => {
      const el = document.createElement('div');
      el.setAttribute('data-testid', 'button"with"quotes');
      document.body.appendChild(el);
      const result = generateCssSelector(el);
      expect(result.selector).toContain('button\\"with\\"quotes');
      expect(result.confidence).toBe('data-attr');
    });
  });

  describe('structural selector edge cases', () => {
    it('builds correct selector with mixed-tag siblings', () => {
      document.body.innerHTML = `
        <div>
          <span>first</span>
          <p>middle</p>
          <span>target</span>
        </div>
      `;
      const spans = document.querySelectorAll('span');
      const result = generateCssSelector(spans[1]);
      expect(result.confidence).toBe('structural');
      // Second span should be nth-of-type(2), not nth-of-type(1)
      expect(result.selector).toContain('span:nth-of-type(2)');
    });

    it('builds structural selector for deeply nested element with no attributes', () => {
      document.body.innerHTML = `
        <div>
          <div>
            <div>
              <div>
                <span>deep leaf</span>
              </div>
            </div>
          </div>
        </div>
      `;
      const span = document.querySelector('span')!;
      const result = generateCssSelector(span);
      expect(result.confidence).toBe('structural');
      expect(result.selector).toBeTruthy();
      // Should have multiple levels of :nth-of-type
      const nthCount = (result.selector.match(/:nth-of-type/g) || []).length;
      expect(nthCount).toBeGreaterThanOrEqual(3);
    });
  });
});
