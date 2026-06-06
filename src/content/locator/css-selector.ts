import type { CssSelectorConfidence } from '../../shared/types';

const GENERATED_CLASS_PATTERN =
  /^(sc-|css-|Mui[A-Z]|chakra-|_[a-zA-Z0-9]{5,}|[a-z]+-[a-z0-9]{6,}$)/;

const GENERATED_ID_PATTERN = /^[a-z]{2,3}-[a-f0-9]{5,}$|^css-[a-f0-9]+|^Mui[A-Z]/;

const DATA_ATTRS = ['data-testid', 'data-test', 'data-cy', 'data-qa'];

function isSemanticClass(cls: string): boolean {
  return !GENERATED_CLASS_PATTERN.test(cls);
}

function isSemanticId(id: string): boolean {
  return !GENERATED_ID_PATTERN.test(id);
}

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function isFormElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea' ||
    tag === 'button'
  );
}

function buildStructuralSelector(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  const maxDepth = 4;

  while (current && current !== document.documentElement && depth < maxDepth) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    // Skip body/html — too generic to qualify with nth-child
    if (tag === 'body' || tag === 'html') {
      parts.unshift(tag);
      break;
    }
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName,
      );
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    } else {
      parts.unshift(tag);
    }
    current = current.parentElement;
    depth++;
  }

  const selector = parts.join(' > ');

  // If not unique, try adding more parent context
  if (!isUnique(selector) && current) {
    return addParentContext(el, selector);
  }

  return selector;
}

function addParentContext(el: Element, selector: string): string {
  let current = el.parentElement;
  let result = selector;

  while (current && current !== document.documentElement) {
    let prefix = '';

    if (current.id && isSemanticId(current.id)) {
      prefix = `#${CSS.escape(current.id)}`;
    } else {
      const semanticClasses = Array.from(current.classList).filter(isSemanticClass);
      if (semanticClasses.length > 0) {
        prefix = `${current.tagName.toLowerCase()}.${semanticClasses.join('.')}`;
      }
    }

    if (prefix) {
      const candidate = `${prefix} > ${result}`;
      if (isUnique(candidate)) return candidate;
      result = candidate;
    }

    current = current.parentElement;
  }

  return result;
}

export function generateCssSelector(el: Element): {
  selector: string;
  confidence: CssSelectorConfidence;
} {
  // Priority 1: data-testid / data-test / data-cy / data-qa
  for (const attr of DATA_ATTRS) {
    const val = el.getAttribute(attr);
    if (val) {
      const s = `[${attr}=${CSS.escape(val)}]`;
      if (isUnique(s)) return { selector: s, confidence: 'data-attr' };
    }
  }

  // Priority 2: semantic id (exclude generated hashes)
  if (el.id && isSemanticId(el.id)) {
    const s = `#${CSS.escape(el.id)}`;
    if (isUnique(s)) return { selector: s, confidence: 'id' };
  }

  // Priority 3: aria-label + tag name
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    const s = `${el.tagName.toLowerCase()}[aria-label=${CSS.escape(ariaLabel)}]`;
    if (isUnique(s)) return { selector: s, confidence: 'aria' };
  }

  // Priority 3b: role attribute
  const role = el.getAttribute('role');
  if (role) {
    const s = `[role=${CSS.escape(role)}]`;
    if (isUnique(s)) return { selector: s, confidence: 'aria' };
  }

  // Priority 4: form name attribute
  const name = el.getAttribute('name');
  if (name && isFormElement(el)) {
    const s = `${el.tagName.toLowerCase()}[name=${CSS.escape(name)}]`;
    if (isUnique(s)) return { selector: s, confidence: 'name' };
  }

  // Priority 5: semantic class combination
  const semanticClasses = Array.from(el.classList).filter(isSemanticClass);
  if (semanticClasses.length > 0) {
    const s = `${el.tagName.toLowerCase()}.${semanticClasses.join('.')}`;
    if (isUnique(s)) return { selector: s, confidence: 'semantic-class' };
  }

  // Priority 6: structural selector with nth-child
  return { selector: buildStructuralSelector(el), confidence: 'structural' };
}
