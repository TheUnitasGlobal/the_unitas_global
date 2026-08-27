const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test('agent toolkit manifest preserves the coin-core checkout boundary', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/agent-toolkit.json'), 'utf8'));
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/coin-checkout-session.json'), 'utf8'));

  expect(manifest.revenueModules).toEqual(['Arche', 'Arena', 'Score', 'Fate', 'Codex22']);
  expect(manifest.checkoutContract.productionFunction).toBe('create-coin-checkout-session');
  expect(manifest.checkoutContract.requestField).toBe('bundle');
  expect(manifest.checkoutContract.clientMaySendPriceId).toBe(false);
  expect(manifest.checkoutContract.clientMaySendAmount).toBe(false);
  expect(fixture.source).toBe('local-test-fixture');
  expect(fixture.mode).toBe('payment');
});
