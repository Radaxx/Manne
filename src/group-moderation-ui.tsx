import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { Avatar } from './avatar';
import { localDate, longDate } from './dates';
import {
  banMember,
  dismissGroupReports,
  type GroupRole,
  removeGroupIntention,
  removeMember,
  restoreGroupIntention,
  unbanMember,
} from './groups';
import { canActOnAuthor, type GroupBan, type GroupReport, pendingReportsLabel, reasonSummary } from './moderation';
import { openProfile } from './profile-ui';
import { Text } from './text';
import { useThemed } from './theme';

type Task = () => Promise<{ ok: boolean; message?: string }>;
/** Lance une action du serveur puis relit l'écran (celle de l'écran des réglages). */
type Run = (key: string, task: Task, success?: string) => Promise<boolean>;

function confirm(title: string, message: string, label: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: label, style: 'destructive', onPress: onConfirm },
  ]);
}

const when = (iso: string) => longDate(localDate(new Date(iso)));

/** Les intentions signalées et pas encore traitées : Rétablir, Laisser visible, Retirer, et l'auteur. */
export function GroupReportsSection({
  groupId,
  reports,
  myRole,
  myHandle,
  busy,
  run,
}: {
  groupId: string;
  reports: GroupReport[];
  myRole: GroupRole;
  myHandle: string | null;
  busy: string | null;
  run: Run;
}) {
  const { styles } = useThemed(stylesFor);
  return (
    <View>
      <Text style={styles.section}>Signalements</Text>
      {reports.length === 0 ? (
        <Text style={styles.muted}>Aucun signalement à traiter.</Text>
      ) : (
        <>
          <Text style={styles.muted}>
            {pendingReportsLabel(reports.length)}. Trois signalements en cours masquent une intention pour les autres membres.
          </Text>
          {reports.map((report) => {
            const key = `report:${report.id}`;
            const author = canActOnAuthor(myRole, report, myHandle);
            return (
              <View key={report.id} style={styles.card}>
                {report.handle ? (
                  <Pressable onPress={() => openProfile(report.handle)} style={styles.person} accessibilityRole="button">
                    <Avatar handle={report.handle} size={36} />
                    <Text style={styles.name} numberOfLines={1}>
                      @{report.handle}
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={styles.body}>{report.body}</Text>
                <Text style={styles.meta}>
                  {report.reports === 1 ? '1 signalement' : `${report.reports} signalements`}
                  {reasonSummary(report.reasons) ? ` · ${reasonSummary(report.reasons)}` : ''}
                </Text>
                <Text style={styles.meta}>
                  {report.hidden ? 'Masquée pour les autres membres.' : 'Encore visible pour les autres membres.'}
                </Text>
                <View style={styles.actions}>
                  {report.hidden ? (
                    <Pressable
                      onPress={() => void run(key, () => restoreGroupIntention(report.id))}
                      disabled={!!busy}
                      hitSlop={6}
                      accessibilityRole="button"
                    >
                      <Text style={styles.action}>Rétablir</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => void run(key, () => dismissGroupReports(report.id))}
                      disabled={!!busy}
                      hitSlop={6}
                      accessibilityRole="button"
                    >
                      <Text style={styles.action}>Laisser visible</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() =>
                      confirm(
                        'Retirer cette intention ?',
                        'Elle disparaît pour tous les membres du groupe.',
                        'Retirer',
                        () => void run(key, () => removeGroupIntention(report.id)),
                      )
                    }
                    disabled={!!busy}
                    hitSlop={6}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.action, styles.danger]}>Retirer</Text>
                  </Pressable>
                  {author ? (
                    <>
                      <Pressable
                        onPress={() =>
                          confirm(
                            `Exclure @${report.handle} ?`,
                            'Cette personne sort du groupe et ses intentions y sont retirées. Elle peut revenir si elle a le code d’invitation.',
                            'Exclure',
                            () => void run(key, () => removeMember(groupId, report.handle)),
                          )
                        }
                        disabled={!!busy}
                        hitSlop={6}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.action, styles.danger]}>Exclure</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          confirm(
                            `Exclure et bannir @${report.handle} ?`,
                            'Cette personne sort du groupe, ses intentions y sont retirées, et elle ne peut plus le rejoindre, même avec le code d’invitation. Tu pourras lever le bannissement plus bas, dans « Personnes bannies ».',
                            'Exclure et bannir',
                            () => void run(key, () => banMember(groupId, report.handle)),
                          )
                        }
                        disabled={!!busy}
                        hitSlop={6}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.action, styles.danger]}>Exclure et bannir</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

/** Les personnes bannies du groupe, avec « Lever le bannissement ». */
export function GroupBansSection({ groupId, bans, busy, run }: { groupId: string; bans: GroupBan[]; busy: string | null; run: Run }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View>
      <Text style={styles.section}>Personnes bannies</Text>
      {bans.length === 0 ? (
        <Text style={styles.muted}>Personne n’est banni de ce groupe.</Text>
      ) : (
        <>
          <Text style={styles.muted}>Ces personnes ne peuvent plus rejoindre le groupe, même avec le code d’invitation.</Text>
          {bans.map((ban) => (
            <View key={ban.handle} style={styles.card}>
              <Pressable onPress={() => openProfile(ban.handle)} style={styles.person} accessibilityRole="button">
                <Avatar handle={ban.handle} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    @{ban.handle}
                  </Text>
                  <Text style={styles.meta}>
                    Banni le {when(ban.createdAt)}
                    {ban.bannedBy ? ` par @${ban.bannedBy}` : ''}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    confirm(
                      `Lever le bannissement de @${ban.handle} ?`,
                      'Cette personne pourra de nouveau rejoindre le groupe.',
                      'Lever le bannissement',
                      () => void run(`unban:${ban.handle}`, () => unbanMember(groupId, ban.handle)),
                    )
                  }
                  disabled={!!busy}
                  hitSlop={6}
                  accessibilityRole="button"
                >
                  <Text style={styles.action}>Lever le bannissement</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    section: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 6 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    card: { backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 8, marginTop: 8 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { color: C.text, fontSize: 16, fontWeight: '700' },
    body: { color: C.text, fontSize: 16, lineHeight: 23 },
    meta: { color: C.muted, fontSize: 13, lineHeight: 18 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
    action: { color: C.gold, fontSize: 14, fontWeight: '700' },
    danger: { color: C.red },
  });
