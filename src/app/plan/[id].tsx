import { useLocalSearchParams } from 'expo-router';
import { PlanReadingScreen } from '../../plan-reading';

export default function PlanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlanReadingScreen id={id} />;
}
