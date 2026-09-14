/**
 * The widget audience: `widgetContract`, the five procedures the embedded widget calls, mirrored into
 * `widget/src/sdk/contract.ts` by `scripts/sync-consumers.mjs`.
 *
 * Hand-written — the script only READS this file to walk its import closure, so a procedure the widget
 * needs is added here by hand. Changing this closure means republishing the widget to npm and repinning
 * `app`'s lockfile even when the widget repo itself did not change: infra's gate checks the build a
 * customer's browser actually loads, not this repo's copy.
 *
 * `activityLogCreate` (`contracts/activityLog.ts`) was dropped from here: the `widget_question` row is
 * now derived server-side in `widgetMessagePost`'s handler from the application already bound to
 * `chat_id` at stream registration, so the widget client has no remaining reason to call it.
 *
 * `tests/unit/audience-drift.test.ts` pins the exact key list and asserts each is the same object identity
 * as `fullContract`'s.
 */
import { chatCreate } from './contracts/chat';
import { widgetDefaultGet, widgetMessagePost, widgetPublicSearch, widgetStream } from './contracts/widget';

export const widgetContract = {
  chatCreate,
  widgetDefaultGet,
  widgetPublicSearch,
  widgetMessagePost,
  widgetStream,
};
