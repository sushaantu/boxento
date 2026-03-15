import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

function getRuleBlock(selectorPattern: RegExp) {
  const match = css.match(selectorPattern);

  expect(match).not.toBeNull();

  return match![1];
}

describe('dashboard resize handle styles', () => {
  it('restores the curved 30px resize corner treatment', () => {
    const styleBlock = getRuleBlock(
      /\.react-resizable-handle::after,[\s\S]*?\.react-grid-item \.react-resizable-handle::after\s*\{([\s\S]*?)\}/
    );

    expect(styleBlock).toMatch(/width:\s*30px;/);
    expect(styleBlock).toMatch(/height:\s*30px;/);
    expect(styleBlock).toMatch(/pointer-events:\s*none;/);
    expect(styleBlock).toMatch(/border-right:\s*2px solid rgba\(15,\s*23,\s*42,\s*0\.2\);/);
    expect(styleBlock).toMatch(/border-bottom:\s*2px solid rgba\(15,\s*23,\s*42,\s*0\.2\);/);
    expect(styleBlock).toMatch(/border-radius:\s*0 0 var\(--border-radius-standard\) 0;/);
  });

  it('keeps the dark mode stroke color rules', () => {
    const darkModeBlock = getRuleBlock(
      /\.dark \.react-resizable-handle::after,[\s\S]*?\.dark \.react-grid-item \.react-resizable-handle::after\s*\{([\s\S]*?)\}/
    );

    expect(darkModeBlock).toMatch(/border-right-color:\s*rgba\(255,\s*255,\s*255,\s*0\.3\);/);
    expect(darkModeBlock).toMatch(/border-bottom-color:\s*rgba\(255,\s*255,\s*255,\s*0\.3\);/);
  });

  it('keeps the hover reveal rule', () => {
    const hoverBlock = getRuleBlock(
      /\.widget-container:hover \.react-resizable-handle,[\s\S]*?\.react-grid-item:focus-within \.react-resizable-handle\s*\{([\s\S]*?)\}/
    );

    expect(hoverBlock).toMatch(/opacity:\s*1;/);
  });

  it('keeps the coarse pointer sizing rule', () => {
    expect(css).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;[\s\S]*?opacity:\s*1;[\s\S]*?\}/
    );
  });
});
