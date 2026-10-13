import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, AppState, type GestureResponderEvent, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import type { RosaryStep } from './rosary';
import { createRosaryScene, type RosaryScene } from './rosary-scene';

type Props = {
  steps: RosaryStep[];
  index: number;
  peek?: boolean;
  finished?: boolean;
  /** Un grain de plus (1) ou de moins (-1), demandé par le geste. */
  onStep?: (delta: 1 | -1) => void;
  /** La 3D n'a pas pu démarrer ou s'est arrêtée : l'écran affiche alors le chapelet à plat. */
  onError?: (e: unknown) => void;
  style?: StyleProp<ViewStyle>;
};

const PULL = 150; // points à glisser pour passer franchement un grain

/**
 * Le chapelet en bois d'olivier, en 3D. On l'égrène en le tirant vers soi (glisser vers le bas)
 * ou d'une simple touche ; glisser vers le haut revient en arrière.
 */
export function Rosary3D({ steps, index, peek = false, finished = false, onStep, onError, style }: Props) {
  const scene = useRef<RosaryScene | null>(null);
  const view = useRef({ steps, index, peek, finished });
  const stepRef = useRef(onStep);
  const errorRef = useRef(onError);
  const reduced = useRef(false);

  // Les rappels du geste et de la création du contexte lisent toujours les dernières valeurs.
  useEffect(() => {
    view.current = { steps, index, peek, finished };
    stepRef.current = onStep;
    errorRef.current = onError;
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => (reduced.current = v))
      .catch(() => {});
    // Rien ne se dessine quand l'app est en arrière-plan.
    const sub = AppState.addEventListener('change', (state) => scene.current?.setActive(state === 'active'));
    return () => {
      sub.remove();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setView({ steps, index, peek, finished });
  }, [steps, index, peek, finished]);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    scene.current?.dispose();
    scene.current = null;
    const fail = (e: unknown) => {
      console.warn('Chapelet 3D indisponible', e);
      errorRef.current?.(e);
    };
    try {
      scene.current = createRosaryScene(gl, { reducedMotion: reduced.current, onError: fail });
      scene.current.setView(view.current);
    } catch (e) {
      fail(e);
    }
  };

  // Le geste : on suit le doigt depuis qu'il s'est posé.
  const touch = useRef({ x: 0, y: 0, t: 0 });
  const progress = (dy: number) => Math.max(-1, Math.min(1, dy / PULL));
  const onRelease = (e: GestureResponderEvent) => {
    scene.current?.setDrag(0);
    const { pageX, pageY } = e.nativeEvent;
    const dx = pageX - touch.current.x,
      dy = pageY - touch.current.y;
    const vy = dy / Math.max(1, Date.now() - touch.current.t); // points par milliseconde
    const p = progress(dy);
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) stepRef.current?.(1);
    else if (p > 0.42 || (vy > 0.55 && dy > 24)) stepRef.current?.(1);
    else if (p < -0.42 || (vy < -0.55 && dy < -24)) stepRef.current?.(-1);
  };

  return (
    <View
      style={style}
      onStartShouldSetResponder={() => !!stepRef.current}
      onResponderGrant={(e) =>
        (touch.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
          t: Date.now(),
        })
      }
      onResponderMove={(e) => scene.current?.setDrag(progress(e.nativeEvent.pageY - touch.current.y))}
      onResponderRelease={onRelease}
      onResponderTerminate={() => scene.current?.setDrag(0)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Chapelet"
      accessibilityHint="Glisser vers le bas pour passer au grain suivant"
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => stepRef.current?.(e.nativeEvent.actionName === 'decrement' ? -1 : 1)}
    >
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}
