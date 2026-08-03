import { describe, expect, it } from 'vitest';
import { shouldRouteSelectAll } from './selectAll';

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe('shouldRouteSelectAll', () => {
  it('keeps native select-all inside the ProseMirror editor', () => {
    const host = mount('<div class="ProseMirror"><p id="t">doc</p></div>');
    expect(shouldRouteSelectAll(host.querySelector('#t'))).toBe(false);
    host.remove();
  });

  it('keeps native select-all inside inputs and textareas (doc title, find overlay)', () => {
    const host = mount('<input class="doc-title" id="t"><textarea id="a"></textarea>');
    expect(shouldRouteSelectAll(host.querySelector('#t'))).toBe(false);
    expect(shouldRouteSelectAll(host.querySelector('#a'))).toBe(false);
    host.remove();
  });

  it('reroutes from window chrome and other non-editable UI', () => {
    const host = mount('<div class="sidebar"><button id="t" type="button">file.md</button></div>');
    expect(shouldRouteSelectAll(host.querySelector('#t'))).toBe(true);
    expect(shouldRouteSelectAll(document.body)).toBe(true);
    expect(shouldRouteSelectAll(null)).toBe(true);
    host.remove();
  });
});
