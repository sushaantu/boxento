import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

describe('dashboard resize handle styles', () => {
  it('restores the curved 30px resize corner treatment', () => {
    expect(css).toMatch(
      /\.react-resizable-handle::after,[\s\S]*?width:\s*30px;[\s\S]*?height:\s*30px;[\s\S]*?border-right:\s*2px solid rgba\(15,\s*23,\s*42,\s*0\.2\);[\s\S]*?border-bottom:\s*2px solid rgba\(15,\s*23,\s*42,\s*0\.2\);[\s\S]*?border-radius:\s*0 0 var\(--border-radius-standard\) 0;/
    );
  });

  it('keeps the hover reveal, touch sizing, and dark mode stroke color rules', () => {
    expect(css).toMatch(
      /\.dark \.react-resizable-handle::after,[\s\S]*?border-right-color:\s*rgba\(255,\s*255,\s*255,\s*0\.3\);[\s\S]*?border-bottom-color:\s*rgba\(255,\s*255,\s*255,\s*0\.3\);/
    );
    expect(css).toMatch(
      /\.widget-container:hover \.react-resizable-handle,[\s\S]*?opacity:\s*1;/
    );
    expect(css).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;[\s\S]*?opacity:\s*1;/
    );
  });
});
