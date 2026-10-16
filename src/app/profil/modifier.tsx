import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '../../auth';
import { haptic } from '../../haptics';
import { BIO_MAX, PARISH_MAX, saveMyProfile } from '../../profile';
import { Button, Field, FormScreen, HandleField, useHandleCheck } from '../../profile-ui';
import { Text } from '../../text';
import { usePalette } from '../../theme';

export default function ModifierProfil() {
  const C = usePalette();
  const { status, profile, profileLoaded, refreshProfile } = useAuth();
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [parish, setParish] = useState(profile?.parish ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useHandleCheck(handle, profile?.handle);

  if (status !== 'signedIn' || (profileLoaded && !profile)) return <Redirect href="/profil" />;
  if (!profile) return null;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await saveMyProfile({ handle, bio, parish }, false);
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    await refreshProfile();
    setBusy(false);
    haptic('success');
    router.back();
  };

  return (
    <FormScreen>
      <HandleField value={handle} onChangeText={setHandle} check={check} />
      <Field label="Bio" value={bio} onChangeText={setBio} max={BIO_MAX} multiline placeholder="Quelques mots sur toi" />
      <Field label="Paroisse ou communauté" value={parish} onChangeText={setParish} max={PARISH_MAX} autoCorrect={false} />
      {error ? <Text style={{ color: C.red, fontSize: 14, marginTop: 8 }}>{error}</Text> : null}
      <Button label="Enregistrer" onPress={() => void save()} disabled={!check.ok} busy={busy} />
    </FormScreen>
  );
}
