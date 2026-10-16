import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Palette } from './appearance';
import type { useAccount } from './auth';
import { CODE_MAX } from './auth/errors';
import { useApp } from './storage';
import { syncProgress } from './sync';
import { useThemed } from './theme';

/** Le formulaire de liaison d'un compte (e-mail et code, Apple, Google), partagé par « Compte » et l'inscription. */
export function AccountForm({
  account,
  title = 'Retrouver ce chemin sur un autre téléphone',
  lead = 'Relie une adresse, Apple ou Google. Ce que tu as déjà lu et prié suit le compte.',
  onFieldFocus,
}: {
  account: ReturnType<typeof useAccount>;
  title?: string;
  lead?: string;
  /** Appelé quand un champ prend le focus (l'écran peut alors le faire remonter au-dessus du clavier). */
  onFieldFocus?: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const { progress, setDisplayName } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{lead}</Text>
      {account.phase.kind === 'link' ? (
        <>
          <Text style={styles.muted}>Un lien a été envoyé à {account.phase.email}. Ouvre-le depuis ce téléphone.</Text>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_MAX))}
            onFocus={onFieldFocus}
            placeholder="Code reçu par e-mail"
            placeholderTextColor={C.faint}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_MAX}
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable onPress={() => account.verifyCode(code)} disabled={account.busy} style={styles.btn}>
            <Text style={styles.btnText}>Valider le code</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCode('');
              account.changeEmail();
            }}
            disabled={account.busy}
            hitSlop={8}
            style={styles.quiet}
          >
            <Text style={styles.link}>Changer d’adresse</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={onFieldFocus}
            placeholder="Adresse e-mail"
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          <Pressable onPress={() => account.sendEmail(email)} disabled={account.busy} style={styles.btn}>
            <Text style={styles.btnText}>Recevoir un lien</Text>
          </Pressable>
        </>
      )}
      {account.apple && (
        <Pressable
          onPress={async () => {
            const given = await account.linkApple();
            if (given && !progress.displayName) setDisplayName(given);
          }}
          disabled={account.busy}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Continuer avec Apple</Text>
        </Pressable>
      )}
      <Pressable onPress={() => account.linkGoogle()} disabled={account.busy} style={styles.secondary}>
        <Text style={styles.secondaryText}>Continuer avec Google</Text>
      </Pressable>
      {account.busy && <ActivityIndicator color={C.gold} />}
      {account.error ? <Text style={styles.error}>{account.error}</Text> : null}
    </View>
  );
}

/** Le compte relié : son adresse, la déconnexion et la suppression (après confirmation). Partagé par « Compte » et le profil. */
export function LinkedAccount({ account }: { account: ReturnType<typeof useAccount> }) {
  const { styles } = useThemed(stylesFor);
  const { progress, hydrate, resetAccountData } = useApp();

  const confirmDelete = () =>
    Alert.alert(
      'Supprimer ton compte ?',
      'Ton compte est effacé pour de bon, avec ce qu’il garde en ligne : ton profil et ce que tu y affiches, tes abonnements et tes blocages, ta progression synchronisée, tes j’aime, tes échos et tes intentions confiées. ' +
        'Sur ce téléphone, ton chemin (lecture, plans, prières, passages gardés, prénom) est aussi effacé, comme à la déconnexion. ' +
        'La liste de ta confession, qui n’a jamais quitté ce téléphone, y reste, ainsi que tes réglages.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void account.deleteAccount(resetAccountData) },
      ],
    );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{account.email ?? 'Compte relié'}</Text>
      <Text style={styles.muted}>Ton chemin est gardé avec ce compte.</Text>
      <Pressable
        onPress={() => account.signOut({ flush: () => syncProgress(() => progress, hydrate), reset: resetAccountData })}
        disabled={account.busy}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Se déconnecter</Text>
      </Pressable>
      <Pressable onPress={confirmDelete} disabled={account.busy} hitSlop={8} style={styles.quiet}>
        <Text style={styles.danger}>Supprimer mon compte</Text>
      </Pressable>
      {account.busy && <ActivityIndicator color={styles.danger.color} />}
      {account.error ? <Text style={styles.error}>{account.error}</Text> : null}
    </View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 10 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    link: { color: C.gold, fontSize: 14, fontWeight: '700' },
    input: {
      color: C.text,
      backgroundColor: C.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      marginTop: 8,
    },
    btn: { backgroundColor: C.gold, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
    btnText: { color: C.onGold, fontWeight: '800', fontSize: 15 },
    secondary: { borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: C.line },
    secondaryText: { color: C.text, fontWeight: '700', fontSize: 15 },
    quiet: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
    danger: { color: C.red, fontSize: 14, fontWeight: '700' },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
  });
