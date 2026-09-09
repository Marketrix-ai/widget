/**
 * The widget audience: `widgetContract`, the seven procedures the embedded widget calls, mirrored into
 * `widget/src/sdk/contract.ts` by `scripts/sync-consumers.mjs`.
 *
 * Hand-written — the script only READS this file to walk its import closure, so a procedure the widget
 * needs is added here by hand. Changing this closure means republishing the widget to npm and repinning
 * `app`'s lockfile even when the widget repo itself did not change: infra's gate checks the build a
 * customer's browser actually loads, not this repo's copy.
 *
 * `tests/unit/audience-drift.test.ts` pins the exact key list and asserts each is the same object identity
 * as `fullContract`'s.
 */
import { activityLogCreate } from './contracts/activityLog';
import { applicationGet } from './contracts/application';
import { chatCreate } from './contracts/chat';
import { widgetDefaultGet, widgetMessagePost, widgetSearch, widgetStream } from './contracts/widget';

export const widgetContract = {
  activityLogCreate,
  applicationGet,
  chatCreate,
  widgetDefaultGet,
  widgetSearch,
  widgetMessagePost,
  widgetStream,
};
