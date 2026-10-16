import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

/**
 * Android edge-to-edge: the window no longer resizes for the keyboard and a
 * KeyboardAvoidingView only knows its position inside its parent, not on screen.
 * Measures how far the keyboard covers the bottom of `ref`, to use as padding.
 * Always 0 on iOS, where KeyboardAvoidingView does the job.
 */
export function useKeyboardOverlap() {
  const ref = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const view = ref.current;
      if (!view) return;
      view.measureInWindow((_x, y, _width, height) => {
        // The padding sits inside the view, so its measured bottom does not move.
        setOverlap(Math.max(0, y + height - event.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { ref, overlap };
}
