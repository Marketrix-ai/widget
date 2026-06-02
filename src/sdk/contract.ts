import { activityLogCreate } from './contracts/activityLog';
import { agentGet } from './contracts/agent';
import { applicationGet } from './contracts/application';
import { chatCreate } from './contracts/chat';
import { widgetGetDefaults, widgetSearch, widgetMessage, widgetStream } from './contracts/widget';

export const widgetContract = {
  activityLogCreate,
  agentGet,
  applicationGet,
  chatCreate,
  widgetGetDefaults,
  widgetSearch,
  widgetMessage,
  widgetStream,
};
