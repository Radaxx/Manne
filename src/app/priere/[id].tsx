import { useLocalSearchParams } from 'expo-router';
import { PrayerScreen } from '../../prayers';

export default function PrayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrayerScreen id={id} />;
}
