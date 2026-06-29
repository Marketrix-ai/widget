import { activityLogCreate } from './contracts/activityLog';
import { applicationGet } from './contracts/application';
import { chatCreate } from './contracts/chat';
import { widgetDefaultGet, widgetMessage, widgetSearch, widgetStream } from './contracts/widget';

export const widgetContract = {
  activityLogCreate,
  applicationGet,
  chatCreate,
  widgetDefaultGet,
  widgetSearch,
  widgetMessage,
  widgetStream,
};
