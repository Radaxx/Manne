import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { AccountForm } from '../../account-form';
import { useAccount, useAuth } from '../../auth';
import { Button, FormScreen, Lead, Title } from '../../profile-ui';
import { usePalette } from '../../theme';

export default function InscriptionConnexion() {
  const C = usePalette();
  const auth = useAuth();
  const account = useAccount();

  if (!auth.configured) {
    return (
      <FormScreen>
        <Title>Crée ton profil</Title>
        <Lead>La connexion n’est pas disponible pour le moment. Ton chemin reste sur ce téléphone.</Lead>
      </FormScreen>
    );
  }

  if (auth.status === 'signedIn') {
    if (!auth.profileLoaded) {
      return (
        <FormScreen>
          <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
        </FormScreen>
      );
    }
    if (auth.profileOffline) {
      return (
        <FormScreen>
          <Title>Crée ton profil</Title>
          <Lead>Ton profil n’a pas pu être lu. Réessaie quand tu as du réseau.</Lead>
          <Button label="Réessayer" onPress={() => void auth.refreshProfile()} />
        </FormScreen>
      );
    }
    return <Redirect href={auth.profile ? '/profil' : '/inscription/pseudo'} />;
  }

  return (
    <FormScreen>
      <Title>Crée ton profil</Title>
      <Lead>Pour avoir un profil, relie d’abord ton compte. Ce que tu as déjà lu et prié suit le compte.</Lead>
      <AccountForm account={account} title="Relier mon compte" lead="Une adresse e-mail, Apple ou Google." />
    </FormScreen>
  );
}
