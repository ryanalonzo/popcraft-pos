import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { fetchCurrentCashier } from '@/api/auth';
import { clearCatalog, getLastSyncTime } from '@/api/catalog';
import { countPending } from '@/api/syncQueue';
import { F } from '@/lib/fonts';
import {
  TcpPrintAdapter,
  UsbPrintAdapter,
  buildTestSlipBytes,
  isUsbPrintingAvailable,
  listUsbDevices,
  requestUsbPermission,
  type UsbDeviceInfo,
} from '@/print';
import { useAuthStore } from '@/state/authStore';
import { getBuildVariant, useSettingsStore } from '@/state/settingsStore';

const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ??
  '0.0.0';

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; message: string }
  | { kind: 'fail'; message: string };

function probeChip(state: ProbeState): { label: string; color: string } {
  switch (state.kind) {
    case 'idle': return { label: '—', color: '#7a6a55' };
    case 'running': return { label: 'Testing…', color: '#b8893d' };
    case 'ok': return { label: state.message, color: '#4a6b3a' };
    case 'fail': return { label: state.message, color: '#a02b10' };
  }
}

export default function SettingsScreen() {
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);
  const printerHost = useSettingsStore((s) => s.printerHost);
  const printerPort = useSettingsStore((s) => s.printerPort);
  const useRealPrinter = useSettingsStore((s) => s.useRealPrinter);
  const printerTransport = useSettingsStore((s) => s.printerTransport);
  const printerUsbDeviceId = useSettingsStore((s) => s.printerUsbDeviceId);
  const printerUsbDeviceLabel = useSettingsStore((s) => s.printerUsbDeviceLabel);
  const setApiBaseUrl = useSettingsStore((s) => s.setApiBaseUrl);
  const setPrinterHost = useSettingsStore((s) => s.setPrinterHost);
  const setPrinterPort = useSettingsStore((s) => s.setPrinterPort);
  const setUseRealPrinter = useSettingsStore((s) => s.setUseRealPrinter);
  const setPrinterTransport = useSettingsStore((s) => s.setPrinterTransport);
  const setPrinterUsbDevice = useSettingsStore((s) => s.setPrinterUsbDevice);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  const logout = useAuthStore((s) => s.logout);

  const [apiInput, setApiInput] = useState(apiBaseUrl);
  const [hostInput, setHostInput] = useState(printerHost);
  const [portInput, setPortInput] = useState(String(printerPort));

  const [apiProbe, setApiProbe] = useState<ProbeState>({ kind: 'idle' });
  const [printerProbe, setPrinterProbe] = useState<ProbeState>({ kind: 'idle' });
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pending, setPending] = useState<number>(0);
  const [usbDevices, setUsbDevices] = useState<UsbDeviceInfo[]>([]);
  const [usbScanState, setUsbScanState] = useState<ProbeState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sync, queue] = await Promise.all([
        getLastSyncTime(),
        countPending(),
      ]);
      if (cancelled) return;
      setLastSync(sync);
      setPending(queue);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveApi = useCallback(() => {
    setApiBaseUrl(apiInput);
    Alert.alert('Saved', 'API base URL updated.');
  }, [apiInput, setApiBaseUrl]);

  const handleSavePrinter = useCallback(() => {
    const portNum = Number.parseInt(portInput, 10);
    if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) {
      Alert.alert('Invalid port', 'Port must be a number between 1 and 65535.');
      return;
    }
    setPrinterHost(hostInput);
    setPrinterPort(portNum);
    Alert.alert('Saved', 'Printer settings updated.');
  }, [hostInput, portInput, setPrinterHost, setPrinterPort]);

  const handleTestApi = useCallback(async () => {
    setApiProbe({ kind: 'running' });
    try {
      const me = await fetchCurrentCashier();
      setApiProbe({ kind: 'ok', message: `OK · ${me.name}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setApiProbe({ kind: 'fail', message });
    }
  }, []);

  const handleTestPrinter = useCallback(async () => {
    setPrinterProbe({ kind: 'running' });
    const jobId = `probe-${Date.now()}`;

    if (printerTransport === 'usb') {
      if (printerUsbDeviceId == null) {
        setPrinterProbe({ kind: 'fail', message: 'No USB device selected' });
        return;
      }
      const label = printerUsbDeviceLabel || `usb#${printerUsbDeviceId}`;
      const bytes = buildTestSlipBytes(label);
      const adapter = new UsbPrintAdapter({ deviceId: printerUsbDeviceId, label });
      const result = await adapter.print({ bytes, openDrawer: false, jobId });
      if (result.success) {
        setPrinterProbe({ kind: 'ok', message: `OK · ${label}` });
      } else {
        setPrinterProbe({ kind: 'fail', message: result.error ?? 'USB print failed' });
      }
      return;
    }

    const portNum = Number.parseInt(portInput, 10);
    const resolvedPort = Number.isFinite(portNum) && portNum > 0 ? portNum : printerPort;
    const target = `${hostInput}:${resolvedPort}`;
    const bytes = buildTestSlipBytes(target);
    const adapter = new TcpPrintAdapter({ host: hostInput, port: resolvedPort, timeoutMs: 4000 });
    const result = await adapter.print({ bytes, openDrawer: false, jobId });
    if (result.success) {
      setPrinterProbe({ kind: 'ok', message: `OK · ${target}` });
    } else {
      setPrinterProbe({ kind: 'fail', message: result.error ?? 'Connection failed' });
    }
  }, [printerTransport, printerUsbDeviceId, printerUsbDeviceLabel, hostInput, portInput, printerPort]);

  const handleScanUsb = useCallback(async () => {
    if (!isUsbPrintingAvailable) {
      setUsbScanState({ kind: 'fail', message: 'USB printing not available on this build' });
      return;
    }
    setUsbScanState({ kind: 'running' });
    try {
      const devices = await listUsbDevices();
      setUsbDevices(devices);
      setUsbScanState({
        kind: 'ok',
        message: `Found ${devices.length} ${devices.length === 1 ? 'device' : 'devices'}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUsbScanState({ kind: 'fail', message });
    }
  }, []);

  const handlePickUsb = useCallback(
    async (device: UsbDeviceInfo) => {
      try {
        const granted = device.hasPermission
          ? true
          : await requestUsbPermission(device.deviceId);
        if (!granted) {
          setPrinterProbe({ kind: 'fail', message: 'USB permission denied' });
          return;
        }
        const label =
          device.productName ||
          device.manufacturerName ||
          device.deviceName ||
          `usb#${device.deviceId}`;
        setPrinterUsbDevice(device.deviceId, label);
        // Refresh the cached list so the chip on the new selection updates.
        const refreshed = await listUsbDevices();
        setUsbDevices(refreshed);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPrinterProbe({ kind: 'fail', message });
      }
    },
    [setPrinterUsbDevice],
  );

  const handleClearCatalog = useCallback(() => {
    Alert.alert(
      'Clear local catalog?',
      'Items and renters will be deleted from this device. The next sync will pull the full catalog from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCatalog();
              setLastSync(null);
              Alert.alert('Cleared', 'Local catalog wiped. Trigger a sync to repopulate.');
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              Alert.alert('Clear failed', message);
            }
          },
        },
      ],
    );
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out?', 'You will need to sign in again to use the till.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }, [logout]);

  const handleReset = useCallback(() => {
    Alert.alert('Reset settings?', 'API URL and printer config will revert to build defaults.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          resetToDefaults();
          const next = useSettingsStore.getState();
          setApiInput(next.apiBaseUrl);
          setHostInput(next.printerHost);
          setPortInput(String(next.printerPort));
        },
      },
    ]);
  }, [resetToDefaults]);

  const apiChip = probeChip(apiProbe);
  const printerChip = probeChip(printerProbe);
  const variant = getBuildVariant();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f4ede0' }}
      contentContainerStyle={{ paddingHorizontal: 32, paddingVertical: 32, paddingBottom: 64 }}
    >
      <Text style={titleStyle}>SETTINGS</Text>
      <Text style={subtitleStyle}>On-device overrides. Persisted across launches.</Text>

      <Section title="API">
        <Label>Base URL</Label>
        <TextInput
          value={apiInput}
          onChangeText={setApiInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://10.0.2.2:8000"
          placeholderTextColor="#b3a48c"
          style={inputStyle}
        />
        <Row>
          <SecondaryButton label="Save" onPress={handleSaveApi} />
          <SecondaryButton label="Test connection" onPress={handleTestApi} />
        </Row>
        <Text style={[probeStyle, { color: apiChip.color }]}>{apiChip.label}</Text>
      </Section>

      <Section title="Printer">
        <Label>Transport</Label>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TransportPill
            label="USB"
            active={printerTransport === 'usb'}
            onPress={() => setPrinterTransport('usb')}
          />
          <TransportPill
            label="Network (TCP)"
            active={printerTransport === 'tcp'}
            onPress={() => setPrinterTransport('tcp')}
          />
        </View>

        {printerTransport === 'usb' ? (
          <>
            <View style={{ marginTop: 18 }}>
              <Label>Selected USB printer</Label>
              <Text
                style={{
                  fontFamily: F.mono,
                  fontSize: 12,
                  color: printerUsbDeviceId != null ? '#1a1410' : '#7a6a55',
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {printerUsbDeviceId != null
                  ? `${printerUsbDeviceLabel || `usb#${printerUsbDeviceId}`} · id ${printerUsbDeviceId}`
                  : 'None — scan and pick one'}
              </Text>
            </View>

            <Row>
              <SecondaryButton label="Scan USB devices" onPress={handleScanUsb} />
              <SecondaryButton
                label="Clear selection"
                onPress={() => setPrinterUsbDevice(null)}
              />
            </Row>
            <Text style={[probeStyle, { color: probeChip(usbScanState).color }]}>
              {probeChip(usbScanState).label}
            </Text>

            {usbDevices.length > 0 ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                {usbDevices.map((d) => {
                  const isSelected = d.deviceId === printerUsbDeviceId;
                  return (
                    <Pressable
                      key={d.deviceId}
                      onPress={() => handlePickUsb(d)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#d23a1a' : 'rgba(26, 20, 16, 0.18)',
                        backgroundColor: isSelected ? 'rgba(210, 58, 26, 0.06)' : '#fff',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: F.mono,
                          fontSize: 12,
                          color: '#1a1410',
                          letterSpacing: 0.6,
                        }}
                        numberOfLines={1}
                      >
                        {d.productName || d.manufacturerName || d.deviceName}
                      </Text>
                      <Text
                        style={{
                          fontFamily: F.mono,
                          fontSize: 10,
                          color: '#7a6a55',
                          marginTop: 2,
                        }}
                      >
                        VID 0x{d.vendorId.toString(16).padStart(4, '0')} · PID 0x
                        {d.productId.toString(16).padStart(4, '0')} ·{' '}
                        {d.hasPermission ? 'granted' : 'needs permission'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ marginTop: 12 }}>
            <Row>
              <View style={{ flex: 2, marginRight: 12 }}>
                <Label>Host</Label>
                <TextInput
                  value={hostInput}
                  onChangeText={setHostInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="192.168.1.50"
                  placeholderTextColor="#b3a48c"
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label>Port</Label>
                <TextInput
                  value={portInput}
                  onChangeText={setPortInput}
                  keyboardType="number-pad"
                  placeholder="9100"
                  placeholderTextColor="#b3a48c"
                  style={inputStyle}
                />
              </View>
            </Row>
            <Row>
              <SecondaryButton label="Save" onPress={handleSavePrinter} />
            </Row>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 4 }}>
          <Switch
            value={useRealPrinter}
            onValueChange={setUseRealPrinter}
            trackColor={{ false: '#b3a48c', true: '#d23a1a' }}
          />
          <Text style={{ marginLeft: 12, fontFamily: F.mono, fontSize: 13, color: '#1a1410' }}>
            Use real printer (off = mock)
          </Text>
        </View>

        <Row>
          <SecondaryButton label="Test print" onPress={handleTestPrinter} />
        </Row>
        <Text style={[probeStyle, { color: printerChip.color }]}>{printerChip.label}</Text>
      </Section>

      <Section title="Local data">
        <InfoRow label="Last catalog sync" value={lastSync ?? 'Never'} />
        <InfoRow label="Pending sales in queue" value={String(pending)} />
        <Row>
          <SecondaryButton label="Clear local catalog" onPress={handleClearCatalog} danger />
        </Row>
      </Section>

      <Section title="About">
        <InfoRow label="App version" value={APP_VERSION} />
        <InfoRow label="Build variant" value={variant} />
        <InfoRow label="Active API" value={apiBaseUrl} />
        <Row>
          <SecondaryButton label="Reset to defaults" onPress={handleReset} />
          <SecondaryButton label="Log out" onPress={handleLogout} danger />
        </Row>
      </Section>
    </ScrollView>
  );
}

/* -------------------- presentational helpers -------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: 24,
        padding: 20,
        backgroundColor: 'rgba(26, 20, 16, 0.03)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(26, 20, 16, 0.08)',
      }}
    >
      <Text style={sectionTitleStyle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={labelStyle}>{children}</Text>;
}

function TransportPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: active ? '#1a1410' : 'rgba(26, 20, 16, 0.25)',
        backgroundColor: active ? '#1a1410' : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 11,
          letterSpacing: 1.5,
          color: active ? '#f4ede0' : '#1a1410',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>{children}</View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#7a6a55', letterSpacing: 1.2 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#1a1410' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SecondaryButton({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: danger ? '#a02b10' : '#1a1410',
        backgroundColor: pressed ? (danger ? '#a02b10' : '#1a1410') : 'transparent',
      })}
    >
      {({ pressed }) => (
        <Text
          style={{
            fontFamily: F.monoSemibold,
            fontSize: 12,
            letterSpacing: 1.8,
            color: pressed ? '#f4ede0' : danger ? '#a02b10' : '#1a1410',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const titleStyle = {
  fontFamily: F.mono,
  fontSize: 16,
  letterSpacing: 3.2,
  color: '#7a6a55',
} as const;

const subtitleStyle = {
  fontFamily: F.serif,
  fontSize: 14,
  color: '#3a2f24',
  marginTop: 6,
} as const;

const sectionTitleStyle = {
  fontFamily: F.mono,
  fontSize: 11,
  letterSpacing: 2.4,
  color: '#7a6a55',
  marginBottom: 14,
} as const;

const labelStyle = {
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1.65,
  color: '#7a6a55',
  marginBottom: 6,
  marginTop: 8,
} as const;

const inputStyle = {
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderWidth: 1.5,
  borderColor: 'rgba(26, 20, 16, 0.25)',
  borderRadius: 4,
  fontFamily: F.mono,
  fontSize: 14,
  color: '#1a1410',
  backgroundColor: '#fff',
} as const;

const probeStyle = {
  marginTop: 12,
  fontFamily: F.mono,
  fontSize: 11,
  letterSpacing: 1.4,
} as const;
