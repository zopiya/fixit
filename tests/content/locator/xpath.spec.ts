import { describe, it, expect, beforeEach } from 'vitest';
import { generateXPath } from '../../../src/content/locator/xpath';

describe('generateXPath', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('relative xpath with id anchor', () => {
    it('returns relative xpath from parent with id', () => {
      document.body.innerHTML = `
        <form id="login-form">
          <input name="user" />
          <button type="submit">Login</button>
        </form>
      `;
      const button = document.querySelector('button')!;
      const result = generateXPath(button);
      expect(result.isRelative).toBe(true);
      expect(result.xpath).toContain("id('login-form')");
      expect(result.xpath).toContain('button');
    });

    it('returns relative xpath from grandparent anchor', () => {
      document.body.innerHTML = `
        <div id="app">
          <div>
            <span>target</span>
          </div>
        </div>
      `;
      const span = document.querySelector('span')!;
      const result = generateXPath(span);
      expect(result.isRelative).toBe(true);
      expect(result.xpath).toContain("id('app')");
      expect(result.xpath).toContain('span');
    });
  });

  describe('relative xpath with data-* anchor', () => {
    it('returns relative xpath from ancestor with data-testid', () => {
      document.body.innerHTML = `
        <div data-testid="container">
          <ul>
            <li>item 1</li>
            <li>item 2</li>
          </ul>
        </div>
      `;
      const items = document.querySelectorAll('li');
      const result = generateXPath(items[1]);
      expect(result.isRelative).toBe(true);
      expect(result.xpath).toContain('data-testid');
      expect(result.xpath).toContain('li[2]');
    });
  });

  describe('absolute xpath fallback', () => {
    it('returns absolute xpath when no stable ancestors exist', () => {
      document.body.innerHTML = `
        <div>
          <div>
            <span>target</span>
          </div>
        </div>
      `;
      const span = document.querySelector('span')!;
      const result = generateXPath(span);
      expect(result.isRelative).toBe(false);
      expect(result.xpath).toContain('/html');
      expect(result.xpath).toContain('span');
    });
  });

  describe('positional index', () => {
    it('includes positional index for elements with siblings', () => {
      document.body.innerHTML = `
        <ul id="list">
          <li>first</li>
          <li>second</li>
          <li>third</li>
        </ul>
      `;
      const items = document.querySelectorAll('li');
      const result1 = generateXPath(items[1]);
      expect(result1.xpath).toContain('li[2]');
    });

    it('does not include index [1] for only child', () => {
      document.body.innerHTML = `
        <div id="wrapper">
          <span>only</span>
        </div>
      `;
      const span = document.querySelector('span')!;
      const result = generateXPath(span);
      // Single child doesn't need positional index
      expect(result.xpath).not.toContain('span[1]');
    });
  });

  describe('returns string value', () => {
    it('always returns a non-empty xpath string', () => {
      document.body.innerHTML = '<div><p>text</p></div>';
      const p = document.querySelector('p')!;
      const result = generateXPath(p);
      expect(result.xpath).toBeTruthy();
      expect(typeof result.xpath).toBe('string');
    });
  });
});
