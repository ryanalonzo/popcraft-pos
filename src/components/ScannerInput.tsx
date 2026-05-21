import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { emitScan, isScannerPaused } from '@/hooks/useScannerInput';

/**
 * Invisible TextInput that captures barcode-scanner keystrokes.
 *
 * Mount this once per screen that needs scanning. Each render:
 * - It auto-focuses on mount.
 * - On submit (Enter from the scanner) it `emitScan`s and clears.
 * - On blur, after a short delay, it reclaims focus unless the global
 *   pause refcount is non-zero (see `pauseScanner`).
 */
export function ScannerInput() {
  const ref = useRef<TextInput | null>(null);
  const [value, setValue] = useState('');

  const reclaimFocus = useCallback(() => {
    if (isScannerPaused()) return;
    ref.current?.focus();
  }, []);

  useEffect(() => {
    // Tiny delay so the screen has settled before we grab focus.
    const t = setTimeout(reclaimFocus, 100);
    return () => clearTimeout(t);
  }, [reclaimFocus]);

  return (
    // Off-screen container so the input is in the tree but invisible.
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
    >
      <TextInput
        ref={ref}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={(e) => {
          emitScan(e.nativeEvent.text);
          setValue('');
          // Re-focus next tick so the next scan lands here.
          setTimeout(reclaimFocus, 0);
        }}
        onBlur={() => {
          setTimeout(reclaimFocus, 150);
        }}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        blurOnSubmit={false}
        showSoftInputOnFocus={false}
        caretHidden
        // Keep it focusable but hidden from a11y tools.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}
