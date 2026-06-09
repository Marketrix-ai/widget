import { activityLogCreate } from './contracts/activityLog';
import { applicationGet } from './contracts/application';
import { chatCreate } from './contracts/chat';
import { widgetGetDefaults, widgetMessage, widgetSearch, widgetStream } from './contracts/widget';

export const widgetContract = {
  activityLogCreate,
  applicationGet,
  chatCreate,
  widgetGetDefaults,
  widgetSearch,
  widgetMessage,
  widgetStream,
};
