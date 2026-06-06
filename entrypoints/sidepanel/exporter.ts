import type { FixItAnnotation } from '../../src/shared/types';

const CIRCLED_NUMBERS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                         '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];

function circledNumber(n: number): string {
  return CIRCLED_NUMBERS[n - 1] ?? `(${n})`;
}

const CONFIDENCE_EMOJI: Record<string, string> = {
  'data-attr': '🟢',
  'id': '🟢',
  'aria': '🟢',
  'name': '🟢',
  'semantic-class': '🟡',
  'structural': '🔴',
};

export function exportToMarkdown(
  annotations: FixItAnnotation[],
  pageTitle: string,
  pageUrl: string,
): string {
  const timestamp = new Date().toISOString();
  const sorted = [...annotations].sort((a, b) => a.sequenceIndex - b.sequenceIndex);

  const header = [
    `# FixIt Work Order — ${pageTitle}`,
    `**URL**: ${pageUrl}`,
    `**Generated**: ${timestamp}`,
    `**Annotations**: ${annotations.length}`,
    '',
    '---',
    '',
  ].join('\n');

  if (sorted.length === 0) return header.trim();

  const sections = sorted.map((ann) => {
    const emoji = CONFIDENCE_EMOJI[ann.cssSelectorConfidence] ?? '⚪';
    const titleLine = ann.userComment
      ? ann.userComment.split('\n')[0]
      : 'Untitled';

    return [
      `## ${circledNumber(ann.sequenceIndex)} ${titleLine}`,
      '',
      '| Property | Value |',
      '|----------|-------|',
      `| CSS Selector | \`${ann.cssSelector}\` (confidence: ${emoji} ${ann.cssSelectorConfidence}) |`,
      `| XPath | \`${ann.xpath}\` |`,
      `| HTML Snapshot | \`${ann.htmlSnapshot}\` |`,
      '',
      `**User Comment**: ${ann.userComment}`,
      '',
      '---',
      '',
    ].join('\n');
  });

  return header + sections.join('');
}

export async function copyToClipboard(markdown: string): Promise<void> {
  await navigator.clipboard.writeText(markdown);
}
