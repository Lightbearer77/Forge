import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Share, Modal,
} from 'react-native';
import Constants from 'expo-constants';
import { COLORS, FONTS } from '../lib/theme';
import { getSetting, setSetting, getAllTasks, getAllMilestones, getAllRunes } from '../lib/storage';
import { pushSyncFile, serializeTasks } from '../lib/sync';

// The sync token is a FINE-GRAINED GitHub PAT scoped to the Forge repo only
// (Contents: read/write). It is typed here once, stored in the on-device
// SQLite settings table, and never leaves the phone except as the
// Authorization header on pushes.
export default function SettingsPanel({ visible, onClose }) {
  const [token, setToken] = useState('');
  const [tokenDirty, setTokenDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setToken(await getSetting('syncToken'));
      setTokenDirty(false);
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
  about: { fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textMuted, lineHeight: 17 },
});
