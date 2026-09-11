import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../Sports by Josh Hart/index.html', import.meta.url), 'utf8');
const functions = html.slice(html.indexOf('  async function showNeedsPick('), html.indexOf('  // ---- Manual search'));

test('no-match followed by empty search removes the AI range and stale saved value', async () => {
  const text = {};
  const context = vm.createContext({
    current: { value: 20 },
    setText: (id, value) => { text[id] = value; },
    setPriceLabel: (label, source) => { text.label = label; text.source = source; },
    $: () => ({ children: [] }),
    manualSearch: async () => { text['r-price'] = 'No cards found'; },
  });
  vm.runInContext(functions, context);
  await context.showNeedsPick({ player: 'Giovanni', category: 'Pokemon', estimate: '$8-20' });
  assert.equal(text['r-estimate'], 'No verified price');
  assert.equal(text.source, 'unverified');
  assert.equal(context.current.value, null);
});

test('provider failure never displays a model-generated price', () => {
  const text = {};
  const context = vm.createContext({ current: { value: 100 }, setPriceLabel: () => {}, setText: (id, v) => { text[id] = v; } });
  vm.runInContext(functions, context);
  context.showUnverifiedPrice({ estimate: '$15-35' }, 'Provider unavailable');
  assert.equal(text['r-estimate'], 'No verified price');
  assert.equal(context.current.value, null);
});
