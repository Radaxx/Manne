import { Redirect, router } from 'expo-router';
import { useAuth } from '../../auth';
import { Button, FormScreen, HandleField, Lead, useHandleCheck } from '../../profile-ui';
import { useSignup } from '../../signup';

export default function InscriptionPseudo() {
  const { status } = useAuth();
  const { draft, update } = useSignup();
  const check = useHandleCheck(draft.handle);

  if (status !== 'signedIn') return <Redirect href="/inscription" />;

  const ready = check.ok;
  return (
    <FormScreen>
      <Lead>C’est ton pseudo qui s’affiche sur ton profil. On te trouve en le tapant exactement, et ton avatar reprend ses initiales.</Lead>
      <HandleField value={draft.handle} onChangeText={(handle) => update({ handle })} check={check} />
      <Button label="Continuer" onPress={() => router.push('/inscription/details')} disabled={!ready} />
    </FormScreen>
  );
}
