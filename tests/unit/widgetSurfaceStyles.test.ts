import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

const getRuleBlock = (selectorPattern: RegExp) => {
  const match = css.match(selectorPattern);

  expect(match).not.toBeNull();

  return match![1];
};

describe('widget surface styles', () => {
  it('applies the shared layered widget shadow to mobile widget items', () => {
    const mobileItemBlock = getRuleBlock(
      /\.mobile-widget-item\s*\{([\s\S]*?)\}/
    );
    const mobileContainerBlock = getRuleBlock(
      /\.mobile-widget-item \.widget-container\s*\{([\s\S]*?)\}/
    );

    expect(mobileItemBlock).toMatch(/box-shadow:\s*var\(--widget-surface-shadow\);/);
    expect(mobileContainerBlock).toMatch(/box-shadow:\s*none;/);
  });
});
