import { Redirect, router } from 'expo-router';
import { useAuth } from '../../auth';
import { BIO_MAX, PARISH_MAX } from '../../profile';
import { Button, Field, FormScreen, Lead } from '../../profile-ui';
import { useSignup } from '../../signup';

export default function InscriptionDetails() {
  const { status } = useAuth();
  const { draft, update } = useSignup();

  if (status !== 'signedIn') return <Redirect href="/inscription" />;

  return (
    <FormScreen>
      <Lead>Facultatif. Tu pourras le modifier plus tard.</Lead>
      <Field
        label="Bio"
        value={draft.bio}
        onChangeText={(bio) => update({ bio })}
        max={BIO_MAX}
        placeholder="Quelques mots sur toi"
        multiline
      />
      <Field
        label="Paroisse ou communauté"
        value={draft.parish}
        onChangeText={(parish) => update({ parish })}
        max={PARISH_MAX}
        placeholder="Ta paroisse, ta communauté"
        autoCorrect={false}
      />
      <Button label="Continuer" onPress={() => router.push('/inscription/charte')} />
      <Button
        label="Passer"
        kind="quiet"
        onPress={() => {
          update({ bio: '', parish: '' });
          router.push('/inscription/charte');
        }}
      />
    </FormScreen>
  );
}
