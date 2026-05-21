/**
 * Editorial confirmation dialog.
 *
 * Replaces native Alert.alert for in-app prompts so we control the
 * typography, spacing, and motion. Two-button shape only (cancel +
 * confirm). For three-or-more-option pickers, use a custom sheet
 * instead — this component intentionally doesn't grow.
 *
 * Usage:
 *   <ConfirmDialog
 *     visible={open}
 *     title="Log out, Maria?"
 *     message="You'll need internet to sign back in."
 *     cancelLabel="Stay signed in"
 *     confirmLabel="Log out"
 *     destructive
 *     onCancel={() => setOpen(false)}
 *     onConfirm={handleLogout}
 *   />
 */

import { Modal, Pressable, Text, View } from 'react-native';

import { F } from '@/lib/fonts';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** Defaults to "Confirm". */
  confirmLabel?: string;
  /** Renders the primary button in brick red instead of ink. */
  destructive?: boolean;
  /** Disable the confirm button (in-flight async, etc.). */
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmBg = destructive ? '#a02b10' : '#1a1410';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Backdrop — tap-anywhere-to-cancel matches platform expectations. */}
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(26, 20, 16, 0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        {/* Stop propagation so taps inside the card don't dismiss. */}
        <Pressable
          onPress={() => {
            // Absorb taps; do nothing.
          }}
          style={{
            width: '100%',
            maxWidth: 480,
            backgroundColor: '#fbf6ea',
            borderWidth: 1,
            borderColor: 'rgba(26, 20, 16, 0.2)',
            borderRadius: 6,
            paddingHorizontal: 32,
            paddingTop: 28,
            paddingBottom: 22,
          }}
        >
          <Text
            style={{
              fontFamily: F.serif,
              fontSize: 24,
              color: '#1a1410',
              letterSpacing: -0.3,
              lineHeight: 30,
            }}
          >
            {title}
          </Text>

          {message ? (
            <Text
              style={{
                marginTop: 14,
                fontFamily: F.serif,
                fontSize: 15,
                color: '#3a2f24',
                lineHeight: 22,
              }}
            >
              {message}
            </Text>
          ) : null}

          <View
            style={{
              marginTop: 28,
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            <Pressable
              onPress={onCancel}
              disabled={busy}
              android_ripple={{ color: 'rgba(26, 20, 16, 0.12)' }}
              style={{
                minHeight: 44,
                paddingHorizontal: 22,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: '#1a1410',
                backgroundColor: 'transparent',
                opacity: busy ? 0.4 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: F.monoSemibold,
                  fontSize: 12,
                  letterSpacing: 1.8,
                  color: '#1a1410',
                  textTransform: 'uppercase',
                }}
              >
                {cancelLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={busy}
              android_ripple={{ color: 'rgba(244, 237, 224, 0.25)' }}
              style={{
                minHeight: 44,
                paddingHorizontal: 22,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                backgroundColor: confirmBg,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: F.monoSemibold,
                  fontSize: 12,
                  letterSpacing: 1.8,
                  color: '#f4ede0',
                  textTransform: 'uppercase',
                }}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
