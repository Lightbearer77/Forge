import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Share, Modal,
} from 'react-native';
import Constants from 'expo-constants';
import { COLORS, FONTS } from '../lib/theme';
import { getSetting, setSetting, getAllTasks, getAllMilestones, getAllRunes } from '../lib/storage';
import { pushSyncFile, serializeTasks } from '../lib/sync';
import {
  getNotifySettings, setNotifySettings, refreshAllNotifications,
  requestNotificationPermissions, getPermissionStatus, sendTestNotification,
} from '../lib/notifications';

// The sync token is a FINE-GRAINED GitHub PAT scoped to the Forge repo only
// (Contents: read/write). It is typed here once, stored in the on-device
// SQLite settings table, and never leaves the phone except as the
// Authorization header on pushes.
export default function SettingsPanel({ visible, onClose }) {
  const [token, setToken] = useState('');
  const [tokenDirty, setTokenDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState({ enabled: true, time: '09:00', lead: [0, 1] });
  const [notifyTimeText, setNotifyTimeText] = useState('09:00');
  const [notifyLeadText, setNotifyLeadText] = useState('0,1');
  const [permStatus, setPermStatus] = useState('undetermined');
  const [scheduledInfo, setScheduledInfo] = useState(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setToken(await getSetting('syncToken'));
      setTokenDirty(false);
      const n = await getNotifySettings();
      setNotify(n);
      setNotifyTimeText(n.time);
      setNotifyLeadText(n.lead.join(','));
      try { setPermStatus(await getPermissionStatus()); } catch (e) {}
    })();
  }, [visible]);

  const saveToken = async () => {
    await setSetting('syncToken', token.trim());
    setTokenDirty(false);
    Alert.alert('Saved', token.trim() ? 'Sync token stored on-device.' : 'Sync token cleared.');
  };

  const gatherSnapshot = async () => {
    const [tasks, milestones, runes] = await Promise.all([
      getAllTasks({ includeDeleted: true }),
      getAllMilestones({ includeDeleted: true }),
      getAllRunes({ includeDeleted: true }),
    ]);
    return { tasks, milestones, runes };
  };

  const doPush = async () => {
    setBusy(true);
    try {
      const stored = (await getSetting('syncToken')).trim();
      const { tasks, milestones, runes } = await gatherSnapshot();
      const res = await pushSyncFile({ token: stored, tasks, milestones, runes });
      Alert.alert('Pushed', `${res.pushed} records published to forge-sync.json.`);
    } catch (e) {
      Alert.alert('Push failed', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const { tasks, milestones, runes } = await gatherSnapshot();
      const json = JSON.stringify(serializeTasks(tasks, 'Forge', milestones, runes), null, 2);
      await Share.share({ message: json });
    } catch (e) {
      Alert.alert('Export failed', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const applyNotify = async (patch) => {
    const next = { ...notify, ...patch };
    setNotify(next);
    await setNotifySettings(next);
    const res = await refreshAllNotifications();
    setScheduledInfo(res);
    return res;
  };

  const toggleNotify = async () => {
    if (!notify.enabled) {
      const granted = await requestNotificationPermissions();
      setPermStatus(await getPermissionStatus());
      if (!granted) {
        Alert.alert(
          'Permission needed',
          'Enable notifications for The Forge in Android settings, then try again.'
        );
        return;
      }
    }
    await applyNotify({ enabled: !notify.enabled });
  };

  const commitTime = async () => {
    const t = notifyTimeText.trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) {
      Alert.alert('Invalid time', 'Use 24-hour HH:MM, e.g. 09:00 or 18:30.');
      setNotifyTimeText(notify.time);
      return;
    }
    await applyNotify({ time: t });
  };

  const commitLead = async () => {
    const raw = notifyLeadText.trim();
    const parsed = raw.split(',').map(x => parseInt(x.trim(), 10))
      .filter(n => Number.isFinite(n) && n >= 0 && n <= 30);
    if (parsed.length === 0) {
      Alert.alert('Invalid lead days', 'Use comma-separated days, e.g. 0,1 or 0,1,7.');
      setNotifyLeadText(notify.lead.join(','));
      return;
    }
    const lead = [...new Set(parsed)].sort((a, b) => a - b);
    setNotifyLeadText(lead.join(','));
    await applyNotify({ lead });
  };

  const doTestNotification = async () => {
    const granted = await requestNotificationPermissions();
    setPermStatus(await getPermissionStatus());
    if (!granted) {
      Alert.alert('Permission needed', 'Enable notifications for The Forge in Android settings.');
      return;
    }
    await sendTestNotification();
    Alert.alert('Test sent', 'A notification should appear in about 5 seconds.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>SYNC · OUTBOUND</Text>
            <Text style={styles.help}>
              Fine-grained GitHub token, scoped to the Forge repo only
              (Contents: read & write). Stored on this device.
            </Text>
            <View style={styles.tokenRow}>
              <TextInput
                value={token}
                onChangeText={(t) => { setToken(t); setTokenDirty(true); }}
                placeholder="github_pat_…"
                placeholderTextColor={COLORS.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.tokenInput}
              />
              <TouchableOpacity
                onPress={saveToken}
                disabled={!tokenDirty}
                style={[styles.smallBtn, !tokenDirty && { opacity: 0.35 }]}
              >
                <Text style={styles.smallBtnText}>SAVE</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={doPush}
              disabled={busy}
              style={[styles.actionBtn, busy && { opacity: 0.4 }]}
            >
              <Text style={styles.actionBtnText}>⇡ PUSH STATE TO FORGE-SYNC.JSON</Text>
            </TouchableOpacity>
            <Text style={styles.help}>
              Publishes a full snapshot (tasks + milestones, deletions included).
              Receivers merge by last-write-wins — a push can never roll
              anything back.
            </Text>

            <Text style={styles.sectionTitle}>EXPORT</Text>
            <TouchableOpacity
              onPress={doExport}
              disabled={busy}
              style={[styles.actionBtn, busy && { opacity: 0.4 }]}
            >
              <Text style={styles.actionBtnText}>⇪ SHARE SNAPSHOT JSON</Text>
            </TouchableOpacity>
            <Text style={styles.help}>
              Same snapshot via the Android share sheet — send to Claude, save
              to a file, or copy. Works with no token configured.
            </Text>

            <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
            <TouchableOpacity onPress={toggleNotify} style={styles.toggleRow}>
              <View style={[styles.toggleBox, notify.enabled && styles.toggleBoxOn]}>
                <Text style={styles.toggleMark}>{notify.enabled ? '✓' : ''}</Text>
              </View>
              <Text style={styles.toggleLabel}>
                Remind me about due dates
              </Text>
            </TouchableOpacity>

            {notify.enabled && (
              <View>
                <View style={styles.notifyRow}>
                  <Text style={styles.notifyLabel}>Time</Text>
                  <TextInput
                    value={notifyTimeText}
                    onChangeText={setNotifyTimeText}
                    onBlur={commitTime}
                    placeholder="09:00"
                    placeholderTextColor={COLORS.textFaint}
                    keyboardType="numbers-and-punctuation"
                    style={styles.notifyInput}
                  />
                </View>
                <View style={styles.notifyRow}>
                  <Text style={styles.notifyLabel}>Days before</Text>
                  <TextInput
                    value={notifyLeadText}
                    onChangeText={setNotifyLeadText}
                    onBlur={commitLead}
                    placeholder="0,1"
                    placeholderTextColor={COLORS.textFaint}
                    keyboardType="numbers-and-punctuation"
                    style={styles.notifyInput}
                  />
                </View>
                <Text style={styles.help}>
                  Comma-separated. `0` is the due date itself, `1` the day
                  before. Tasks and milestones both fire at this time; nothing
                  fires for overdue or completed items.
                </Text>
              </View>
            )}

            <TouchableOpacity onPress={doTestNotification} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>🔔 SEND TEST NOTIFICATION</Text>
            </TouchableOpacity>
            {scheduledInfo && (
              <Text style={styles.help}>
                {scheduledInfo.skipped
                  ? `Not scheduled (${scheduledInfo.skipped}).`
                  : `${scheduledInfo.scheduled} scheduled · ${scheduledInfo.tasks ?? 0} tasks, ` +
                    `${scheduledInfo.milestones ?? 0} milestones` +
                    (scheduledInfo.nextTitle ? ` · next: ${scheduledInfo.nextTitle}` : '')}
              </Text>
            )}
            {permStatus !== 'granted' && (
              <Text style={styles.help}>
                Permission status: {permStatus}. Android must allow notifications
                for reminders to fire.
              </Text>
            )}

            <Text style={styles.sectionTitle}>ABOUT</Text>
            <Text style={styles.about}>
              The Forge v{Constants.expoConfig?.version ?? '0.x'} · Greek calendar task
              system · G1 deliverable
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1, borderColor: COLORS.borderMid,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  title: { fontSize: 16, fontFamily: FONTS.display, color: COLORS.textPrimary },
  close: { fontSize: 15, color: COLORS.textMuted },
  body: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textFaint, marginTop: 18, marginBottom: 8,
  },
  help: {
    fontSize: 11, fontFamily: FONTS.body, fontStyle: 'italic',
    color: COLORS.textMuted, lineHeight: 16, marginBottom: 10,
  },
  tokenRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  tokenInput: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 12, fontFamily: FONTS.mono, color: COLORS.textPrimary,
  },
  smallBtn: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: COLORS.bgElevated,
  },
  smallBtnText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.accent },
  actionBtn: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.bgSurface,
    marginBottom: 6,
  },
  actionBtnText: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 1.5, color: COLORS.textSecondary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  toggleBox: {
    width: 20, height: 20, borderRadius: 3, borderWidth: 1,
    borderColor: COLORS.borderMid, alignItems: 'center', justifyContent: 'center',
  },
  toggleBoxOn: { borderColor: COLORS.accent, backgroundColor: `${COLORS.accent}22` },
  toggleMark: { fontSize: 12, color: COLORS.accent },
  toggleLabel: { fontSize: 13, color: COLORS.textPrimary, flex: 1 },
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  notifyLabel: { fontSize: 12, color: COLORS.textMuted, width: 96 },
  notifyInput: {
    flex: 1, backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: COLORS.textPrimary,
  },
  about: { fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textMuted, lineHeight: 17 },
});
