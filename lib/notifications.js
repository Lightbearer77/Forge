// ─── Local notifications via expo-notifications ───
// Works in EAS development/preview/production builds (not Expo Go).
//
// Forge notifies on DUE DATES only — tasks and milestones — at a configured
// time of day, with configurable lead days. There are no per-task reminder
// offsets by design: HabitNow owns recurring cadence, The Hearth owns
// time-of-day events, and Forge owns "this is due".
//
// The whole window is cancel-all + reschedule on every refresh, so state
// stays duplicate-free. Capped at 48 alarms, nearest-first, 90-day horizon.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getAllTasks, getAllMilestones, getSetting, setSetting } from './storage';
import {
  buildTriggers, summarize, parseLead,
  CHANNELS, NOTIFY_DEFAULTS, MAX_SCHEDULED, HORIZON_DAYS,
} from './notifySchedule';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Settings ───
export const SETTING_KEYS = {
  enabled: 'notifyEnabled',
  time: 'notifyTime',
  lead: 'notifyLead',
};

export const getNotifySettings = async () => {
  const [enabled, time, lead] = await Promise.all([
    getSetting(SETTING_KEYS.enabled),
    getSetting(SETTING_KEYS.time),
    getSetting(SETTING_KEYS.lead),
  ]);
  return {
    enabled: enabled === '' ? NOTIFY_DEFAULTS.enabled : enabled === '1',
    time: time || NOTIFY_DEFAULTS.time,
    lead: parseLead(lead === '' ? null : lead),
  };
};

export const setNotifySettings = async ({ enabled, time, lead }) => {
  if (enabled !== undefined) await setSetting(SETTING_KEYS.enabled, enabled ? '1' : '0');
  if (time !== undefined) await setSetting(SETTING_KEYS.time, time);
  if (lead !== undefined) {
    await setSetting(SETTING_KEYS.lead, Array.isArray(lead) ? lead.join(',') : String(lead));
  }
};

// ─── Permissions & channels ───
export const requestNotificationPermissions = async () => {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') {
    await ensureAndroidChannels();
    return true;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  await ensureAndroidChannels();
  return true;
};

export const getPermissionStatus = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  return status; // 'granted' | 'denied' | 'undetermined'
};

const ensureAndroidChannels = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNELS.tasks, {
    name: 'Task Due Dates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#c9a84c',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.milestones, {
    name: 'Milestones',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#8a9bb0',
    sound: 'default',
  });
};

// ─── Refresh the rolling window ───
export const refreshAllNotifications = async () => {
  const settings = await getNotifySettings();
  if (!settings.enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { scheduled: 0, total: 0, skipped: 'disabled' };
  }

  const status = await getPermissionStatus();
  if (status !== 'granted') {
    return { scheduled: 0, total: 0, skipped: 'no-permission' };
  }

  await ensureAndroidChannels();
  await Notifications.cancelAllScheduledNotificationsAsync();

  let tasks = [], milestones = [];
  try {
    [tasks, milestones] = await Promise.all([getAllTasks(), getAllMilestones()]);
  } catch (e) {
    console.warn('[Notifications] load failed:', e?.message);
    return { scheduled: 0, total: 0, skipped: 'load-failed' };
  }

  const triggers = buildTriggers({
    tasks, milestones,
    now: new Date(),
    time: settings.time,
    lead: settings.lead,
    horizonDays: HORIZON_DAYS,
    max: MAX_SCHEDULED,
  });

  let scheduled = 0;
  for (const t of triggers) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: t.id,
        content: { title: t.title, body: t.body, data: t.data, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: t.fireAt,
          channelId: Platform.OS === 'android' ? t.channelId : undefined,
        },
      });
      scheduled++;
    } catch (e) {
      console.warn(`[Notifications] schedule failed ${t.id}:`, e?.message);
    }
  }

  return { scheduled, ...summarize(triggers) };
};

// ─── Debug / settings helpers ───
export const getScheduledNotifications = async () =>
  await Notifications.getAllScheduledNotificationsAsync();

export const cancelAllNotifications = async () =>
  await Notifications.cancelAllScheduledNotificationsAsync();

export const sendTestNotification = async () => {
  await ensureAndroidChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'The Forge',
      body: 'Notifications are working.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: Platform.OS === 'android' ? CHANNELS.tasks : undefined,
    },
  });
};
