/**
 * The widget audience: `widgetContract`, the four procedures the embedded widget calls, mirrored into
 * `widget/src/sdk/contract.ts`.
 *
 * Hand-written — a procedure the widget needs is added here by hand.
 */
import { chatCreate } from './contracts/chat';
import { widgetMessagePost, widgetPublicSearch, widgetStream } from './contracts/widget';

export const widgetContract = {
  chatCreate,
  widgetPublicSearch,
  widgetMessagePost,
  widgetStream,
};
