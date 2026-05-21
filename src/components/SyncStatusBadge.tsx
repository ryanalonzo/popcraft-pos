/**
 * Sync detail modal.
 *
 * Opened from the chrome's status pills (online + sync). Editorial Craft
 * styling: warm-paper panel that floats from the top-right, italic
 * Fraunces detail line, mono micro-rows, dark `SYNC NOW` action.
 */

import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { useSyncWorker } from '@/hooks/useSyncWorker';
import { F } from '@/lib/fonts';

interface SyncDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SyncDetailModal({ visible, onClose }: SyncDetailModalProps) {
  const { pendingCount, isProcessing, lastSyncAt, isOnline, processNow } =
    useSyncWorker();

  const stateLabel = isProcessing
    ? `Syncing ${pendingCount}…`
    : pendingCount > 0
      ? `${pendingCount} pending`
      : isOnline === false
        ? 'Offline'
        : 'Synced.';

  const stateDot = isProcessing
    ? '#b8893d'
    : isOnline === false
      ? '#a02b10'
      : pendingCount > 0
        ? '#b8893d'
        : '#4a6b3a';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          alignItems: 'flex-end',
          paddingTop: 80,
          paddingRight: 24,
          backgroundColor: 'rgba(26, 20, 16, 0.25)',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: 360,
            backgroundColor: '#f4ede0',
            borderWidth: 1,
            borderColor: 'rgba(26, 20, 16, 0.12)',
            borderRadius: 6,
            shadowColor: '#1a1410',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.18,
            shadowRadius: 28,
          }}
        >
          {/* Head */}
          <View
            style={{
              paddingHorizontal: 22,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: 'rgba(26, 20, 16, 0.12)',
            }}
          >
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: 2.2,
                color: '#7a6a55',
              }}
            >
              SYNC STATUS
            </Text>
            <View
              className="flex-row items-baseline"
              style={{ marginTop: 6, gap: 10 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: stateDot,
                  alignSelf: 'center',
                  shadowColor: stateDot,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 4,
                }}
              />
              <Text
                style={{
                  fontFamily: F.serifItalic,
                  fontSize: 26,
                  color: '#1a1410',
                  letterSpacing: -0.4,
                }}
              >
                {stateLabel}
              </Text>
            </View>
          </View>

          {/* Rows */}
          <View style={{ paddingHorizontal: 22, paddingVertical: 18 }}>
            <Row
              label="NETWORK"
              value={
                isOnline === null ? 'unknown' : isOnline ? 'online' : 'offline'
              }
            />
            <Row label="PENDING" value={String(pendingCount)} />
            <Row
              label="LAST SYNC"
              value={
                lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'never'
              }
            />
          </View>

          <View
            style={{
              paddingHorizontal: 22,
              paddingBottom: 18,
            }}
          >
            <Pressable
              onPress={() => processNow()}
              disabled={isProcessing}
              style={{
                paddingVertical: 14,
                borderRadius: 4,
                backgroundColor: isProcessing ? 'rgba(26, 20, 16, 0.35)' : '#1a1410',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: F.monoSemibold,
                  fontSize: 12,
                  letterSpacing: 2.5,
                  color: '#f4ede0',
                }}
              >
                {isProcessing ? 'SYNCING…' : 'SYNC NOW'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-baseline justify-between"
      style={{ paddingVertical: 6 }}
    >
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 1.6,
          color: '#7a6a55',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: F.serif,
          fontSize: 14,
          color: '#1a1410',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/** Back-compat wrapper — most callers should use `SyncDetailModal` directly. */
export function SyncStatusBadge() {
  const [open, setOpen] = useState(false);
  return <SyncDetailModal visible={open} onClose={() => setOpen(false)} />;
}
