import { useLocalSearchParams } from 'expo-router';
import { firstParam } from '../../groups';
import { InviteLanding } from '../../invite-screen';

/** Atterrissage du lien `manne://rejoindre/<code>`. */
export default function RejoindreParLien() {
  const code = firstParam(useLocalSearchParams<{ code?: string | string[] }>().code);
  return <InviteLanding code={code} />;
}
