/**
 * The widget audience: `widgetContract`, the five procedures the embedded widget calls, mirrored into
 * `widget/src/sdk/contract.ts`.
 *
 * Hand-written — a procedure the widget needs is added here by hand.
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
