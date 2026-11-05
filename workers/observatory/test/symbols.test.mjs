import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSymbol, symbolDescriptions } from '../client/symbols.js';

class Element {
  constructor(tag, document) { this.tag = tag; this.ownerDocument = document; this.attributes = {}; this.children = []; this.dataset = {}; }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
}
function stage() {
  const document = { createElementNS(namespace, tag) {
    assert.equal(namespace, 'http://www.w3.org/2000/svg');
    return new Element(tag, document);
  } };
  return new Element('div', document);
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }

test('switching subjects replaces the former diagram instead of accumulating animated scenes', () => {
  const target = stage();
  const signatures = new Set();
  for (const kind of ['dialogue', 'futures', 'folio', 'atlas', 'vessel', 'neuron', 'race']) {
    assert.equal(renderSymbol(target, kind), kind);
    assert.equal(target.children.length, 1);
    const svg = target.children[0];
    assert.equal(svg.attributes.viewBox, '0 0 300 300');
    assert.equal(svg.attributes['aria-label'], symbolDescriptions[kind]);
    assert.equal(svg.attributes.role, 'img');
    assert.equal(target.dataset.symbol, kind);
    signatures.add(JSON.stringify(descendants(svg).map(({ tag, attributes }) => ({ tag, attributes }))));
  }
  assert.equal(signatures.size, 7);
});

test('catalog-supplied kind cannot create markup, external resources, event handlers, or prototype lookups', () => {
  const target = stage();
  for (const untrusted of ['__proto__', 'constructor', 'toString', '<script>alert(1)</script>', 'folio" onload="alert(1)', null, {}, 0]) {
    assert.equal(renderSymbol(target, untrusted), 'directory');
    assert.equal(target.dataset.symbol, 'directory');
    for (const node of descendants(target.children[0])) {
      assert.ok(['svg', 'g', 'path', 'line', 'circle', 'rect'].includes(node.tag));
      for (const name of Object.keys(node.attributes)) assert.ok(!/^(?:on|href|src)/i.test(name));
      assert.ok(!JSON.stringify(node.attributes).includes('alert'));
    }
  }
});
