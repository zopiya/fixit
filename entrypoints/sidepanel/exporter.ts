import type { FixItAnnotation } from '../../src/shared/types';
import { circledNumber } from '../../src/shared/utils';
import { t } from '../../src/shared/i18n';
import { getSettings } from '../../src/shared/settings';

const CONFIDENCE_EMOJI: Record<string, string> = {
  'data-attr': '🟢',
  'id': '🟢',
  'aria': '🟢',
  'name': '🟢',
  'semantic-class': '🟡',
  'structural': '🔴',
};

export async function exportToMarkdown(
  annotations: FixItAnnotation[],
  pageTitle: string,
  pageUrl: string,
): Promise<string> {
  const settings = await getSettings();
  const ctx = settings.copyContext;
  const timestamp = new Date().toISOString();
  const sorted = [...annotations].sort((a, b) => a.sequenceIndex - b.sequenceIndex);

  const header = [
    `# ${t('export.title')} — ${pageTitle}`,
    `**${t('export.url')}**: ${pageUrl}`,
    `**${t('export.time')}**: ${timestamp}`,
    `**${t('export.count')}**: ${annotations.length}`,
    '',
    '---',
    '',
  ].join('\n');

  if (sorted.length === 0) return header.trim();

  const sections = sorted.map((ann) => {
    const lines: string[] = [];
    const titleLine = ann.userComment
      ? ann.userComment.split('\n')[0]
      : 'Untitled';

    lines.push(`## ${circledNumber(ann.sequenceIndex)} ${titleLine}`, '');

    if (ctx.comment) {
      lines.push(`**${t('export.requirement')}**：${ann.userComment}`, '');
    }

    if (ctx.cssSelector || ctx.xpath || ctx.confidence) {
      lines.push(`**${t('export.locator')}**：`, '');
      lines.push('| | |', '|---|---|');

      if (ctx.cssSelector) {
        const emoji = CONFIDENCE_EMOJI[ann.cssSelectorConfidence] ?? '⚪';
        const confidenceText = t(`confidence.${ann.cssSelectorConfidence}`);
        const confidenceLabel = ctx.confidence ? ` (${emoji} ${confidenceText})` : '';
        lines.push(`| CSS Selector | \`${ann.cssSelector}\`${confidenceLabel} |`);
      }

      if (ctx.xpath) {
        lines.push(`| XPath | \`${ann.xpath}\` |`);
      }

      lines.push('');
    }

    if (ctx.htmlSnapshot) {
      lines.push(
        `<details><summary>${t('export.snapshot')}</summary>`,
        '',
        '```html',
        ann.htmlSnapshot,
        '```',
        '',
        '</details>',
        '',
      );
    }

    lines.push('---', '');
    return lines.join('\n');
  });

  return header + sections.join('');
}

export async function copyToClipboard(markdown: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch {
    return false;
  }
}
