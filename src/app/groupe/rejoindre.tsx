import { router } from 'expo-router';
import { useState } from 'react';
import { formatInviteCode, isInviteCode, normalizeInviteCode } from '../../groups';
import { Button, Field, FormScreen, Lead } from '../../profile-ui';

export default function RejoindreAvecCode() {
  const [value, setValue] = useState('');
  const code = normalizeInviteCode(value);

  const submit = () => {
    if (!isInviteCode(code)) return;
    router.push({ pathname: '/rejoindre/[code]', params: { code } });
  };

  return (
    <FormScreen>
      <Lead>Saisis le code d’invitation que tu as reçu. Les espaces et les tirets sont ignorés.</Lead>
      <Field
        label="Code d’invitation"
        value={value}
        onChangeText={(text) => setValue(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        placeholder="ABCD-EFGH"
        error={code.length > 0 && !isInviteCode(code) && code.length >= 8}
        hint={code.length >= 8 && !isInviteCode(code) ? 'Ce code n’est pas valide.' : code ? formatInviteCode(code) : undefined}
      />
      <Button label="Continuer" onPress={submit} disabled={!isInviteCode(code)} />
    </FormScreen>
  );
}
