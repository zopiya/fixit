function findStableAncestor(el: Element): Element | null {
  let current = el.parentElement;
  while (current && current !== document.documentElement) {
    if (
      current.id ||
      Array.from(current.attributes).some((a) => a.name.startsWith('data-'))
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function getAnchorXPathExpr(anchor: Element): string {
  if (anchor.id) {
    return `id('${anchor.id}')`;
  }
  // Use first data-* attribute found
  const dataAttr = Array.from(anchor.attributes).find((a) =>
    a.name.startsWith('data-'),
  );
  if (dataAttr) {
    return `//*[@${dataAttr.name}='${dataAttr.value}']`;
  }
  return '';
}

function getTagWithPosition(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;

  const siblings = Array.from(parent.children).filter(
    (c) => c.tagName === el.tagName,
  );
  if (siblings.length <= 1) return tag;
  const index = siblings.indexOf(el) + 1;
  return `${tag}[${index}]`;
}

function buildRelativeXPath(el: Element, anchor: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== anchor) {
    parts.unshift(getTagWithPosition(current));
    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

function buildAbsoluteXPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    parts.unshift(getTagWithPosition(current));
    current = current.parentElement;
  }

  parts.unshift('html');
  return '/' + parts.join('/');
}

export function generateXPath(el: Element): {
  xpath: string;
  isRelative: boolean;
} {
  const anchor = findStableAncestor(el);

  if (!anchor || anchor === document.documentElement) {
    return { xpath: buildAbsoluteXPath(el), isRelative: false };
  }

  const anchorExpr = getAnchorXPathExpr(anchor);
  const relativePath = buildRelativeXPath(el, anchor);
  return { xpath: `${anchorExpr}${relativePath}`, isRelative: true };
}
