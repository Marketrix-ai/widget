/**
 * `StorageService` reads no storage when imported, only on first use, so a host importing the widget during its server
 * render touches no `localStorage`.
 */
import { expect, spyOn, test } from 'bun:test';

test('importing reads no storage; the first read does', async () => {
  const getItem = spyOn(Storage.prototype, 'getItem');
  const { getChatId } = await import('../StorageService');
  expect(getItem).not.toHaveBeenCalled();
  expect(getChatId()).toBeNull();
  expect(getItem).toHaveBeenCalled();
  getItem.mockRestore();
});
