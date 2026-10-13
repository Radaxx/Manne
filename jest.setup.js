// AsyncStorage n'a pas de module natif sous Jest : on utilise le faux stockage en mémoire qu'il fournit.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// Les rappels ne sont pas testés ici ; le vrai module avertit au chargement sur l'absence de notifications distantes.
jest.mock('expo-notifications', () => ({}));
