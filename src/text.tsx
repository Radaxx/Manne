import { createContext, forwardRef, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet, type TextInputProps, type TextProps } from 'react-native';
import { type FontBase, resolveText } from './fonts';

/** La famille du texte parent : un texte emboîté qui ne dit rien de sa police garde celle du parent. */
const FontBaseContext = createContext<FontBase | null>(null);

/** Le `Text` de React Native, avec les polices de l'app (Figtree, ou Newsreader pour `fontFamily: SERIF`). */
export function Text({ style, ...props }: TextProps) {
  const inherited = useContext(FontBaseContext);
  const resolved = resolveText(StyleSheet.flatten(style), inherited);
  if (!resolved) return <RNText style={style} {...props} />;
  const text = <RNText {...props} style={[style, { fontFamily: resolved.face, fontWeight: 'normal', fontStyle: 'normal' }]} />;
  return resolved.base === inherited ? text : <FontBaseContext.Provider value={resolved.base}>{text}</FontBaseContext.Provider>;
}

/** Le `TextInput` de React Native, avec les polices de l'app. Le type `TextInput` sert aux `useRef<TextInput>`. */
export type TextInput = RNTextInput;
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const resolved = resolveText(StyleSheet.flatten(style), null);
  if (!resolved) return <RNTextInput ref={ref} style={style} {...props} />;
  return <RNTextInput ref={ref} {...props} style={[style, { fontFamily: resolved.face, fontWeight: 'normal', fontStyle: 'normal' }]} />;
});
