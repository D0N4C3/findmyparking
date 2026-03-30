import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BluetoothDevice,
  BluetoothConnectionResult,
  BluetoothScanResult,
  scanBluetoothDevices,
  verifyBluetoothDeviceConnection,
} from '@/services/bluetooth';
import { CarBluetoothDevice } from '@/context/ParkingContext';

interface BluetoothDevicePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirmDevice: (device: CarBluetoothDevice) => void;
  onRemoveDevice?: () => void;
  selectedDevice: CarBluetoothDevice | null;
  colors: {
    card: string;
    text: string;
    textMuted: string;
    overlay: string;
    border: string;
    surfaceSecondary: string;
    accent: string;
    error: string;
    success: string;
  };
  title?: string;
  subtitle?: string;
}

export function BluetoothDevicePickerSheet({
  visible,
  onClose,
  onConfirmDevice,
  onRemoveDevice,
  selectedDevice,
  colors,
  title = 'Select Car Bluetooth Device',
  subtitle = 'Nearby and paired devices',
}: BluetoothDevicePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [scanResult, setScanResult] = useState<BluetoothScanResult | null>(null);
  const [pendingDevice, setPendingDevice] = useState<CarBluetoothDevice | null>(null);
  const [connectionResult, setConnectionResult] = useState<BluetoothConnectionResult | null>(null);
  const [isValidatingConnection, setIsValidatingConnection] = useState(false);
  const [scanDurationMs, setScanDurationMs] = useState(15_000);
  const [prioritizePaired, setPrioritizePaired] = useState(true);
  const [prioritizeSignal, setPrioritizeSignal] = useState(true);
  const [showUnknownDevices, setShowUnknownDevices] = useState(false);

  const runBluetoothScan = useCallback(async () => {
    setIsScanningBluetooth(true);
    setScanResult(null);
    setConnectionResult(null);

    const result = await scanBluetoothDevices({ timeoutMs: scanDurationMs, retries: 2 });
    setScanResult(result);
    setIsScanningBluetooth(false);
  }, [scanDurationMs]);

  useEffect(() => {
    if (!visible) return;

    setPendingDevice(selectedDevice);
    void runBluetoothScan();
  }, [visible, selectedDevice, runBluetoothScan]);

  const hasScanError = Boolean(
    scanResult && ['permission-denied', 'unsupported', 'error', 'timeout'].includes(scanResult.status)
  );

  const formatLastSeenLabel = useCallback((lastSeenAt?: number) => {
    if (!lastSeenAt) return null;

    const elapsedMs = Date.now() - lastSeenAt;
    const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1000));
    if (elapsedSeconds < 60) {
      return `${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.round(elapsedSeconds / 60);
    return `${elapsedMinutes}m ago`;
  }, []);

  const scannedDevices = useMemo(() => {
    const devices = scanResult?.devices ?? [];

    return [...devices]
      .filter((device) => (showUnknownDevices ? true : device.name !== 'Unknown device'))
      .sort((a: BluetoothDevice, b: BluetoothDevice) => {
        if (a.name === 'Unknown device' && b.name !== 'Unknown device') return 1;
        if (a.name !== 'Unknown device' && b.name === 'Unknown device') return -1;

        if (prioritizePaired && Boolean(a.isPaired) !== Boolean(b.isPaired)) {
          return a.isPaired ? -1 : 1;
        }

        const aRssi = typeof a.rssi === 'number' ? a.rssi : -Infinity;
        const bRssi = typeof b.rssi === 'number' ? b.rssi : -Infinity;
        if (prioritizeSignal && aRssi !== bRssi) {
          return bRssi - aRssi;
        }

        return a.name.localeCompare(b.name);
      });
  }, [prioritizePaired, prioritizeSignal, scanResult?.devices, showUnknownDevices]);

  const confirmDevice = useCallback(async () => {
    if (!pendingDevice) return;

    setIsValidatingConnection(true);
    const result = await verifyBluetoothDeviceConnection(pendingDevice.id);
    setConnectionResult(result);
    setIsValidatingConnection(false);

    if (result.status === 'connected') {
      onConfirmDevice(pendingDevice);
    }
  }, [onConfirmDevice, pendingDevice]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.bluetoothSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 20) }]}> 
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>

          {isScanningBluetooth ? (
            <View style={styles.scanStateContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.scanStateText, { color: colors.textMuted }]}>Scanning for devices...</Text>
            </View>
          ) : null}

          {hasScanError ? (
            <View style={[styles.scanStateContainer, { backgroundColor: colors.error + '10' }]}> 
              <Text style={[styles.scanStateErrorText, { color: colors.error }]}>
                {scanResult?.message ?? 'Unable to scan right now.'}
              </Text>
            </View>
          ) : null}

          {!isScanningBluetooth && scanResult?.status === 'unsupported' ? (
            <View style={[styles.scanStateContainer, { backgroundColor: colors.surfaceSecondary }]}> 
              <Text style={[styles.scanStateText, { color: colors.textMuted }]}>Use a development/custom build with Bluetooth scanner support to discover nearby devices.</Text>
            </View>
          ) : null}

          {!isScanningBluetooth && scanResult?.status === 'empty' ? (
            <View style={[styles.scanStateContainer, { backgroundColor: colors.surfaceSecondary }]}> 
              <Text style={[styles.scanStateText, { color: colors.textMuted }]}>{scanResult.message}</Text>
            </View>
          ) : null}
          <View style={[styles.scanControls, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.scanControlsTitle, { color: colors.text }]}>Scan duration</Text>
            <View style={styles.durationOptions}>
              {[10_000, 15_000, 25_000].map((duration) => {
                const selected = duration === scanDurationMs;
                return (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationOption,
                      {
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected ? colors.accent + '20' : 'transparent',
                      },
                    ]}
                    onPress={() => setScanDurationMs(duration)}
                  >
                    <Text style={[styles.durationOptionText, { color: selected ? colors.accent : colors.textMuted }]}>
                      {Math.round(duration / 1000)}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Paired devices first</Text>
              <Switch value={prioritizePaired} onValueChange={setPrioritizePaired} trackColor={{ true: colors.accent }} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Strongest signal first</Text>
              <Switch value={prioritizeSignal} onValueChange={setPrioritizeSignal} trackColor={{ true: colors.accent }} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Show unknown devices</Text>
              <Switch value={showUnknownDevices} onValueChange={setShowUnknownDevices} trackColor={{ true: colors.accent }} />
            </View>
          </View>

          <ScrollView style={styles.scanResultsList} contentContainerStyle={styles.scanResultsContent}>
            {scannedDevices.map((device) => {
              const isPending = pendingDevice?.id === device.id;
              const isSaved = selectedDevice?.id === device.id;

              return (
                <TouchableOpacity
                  key={device.id}
                  style={[
                    styles.deviceItem,
                    { backgroundColor: colors.surfaceSecondary, borderColor: isPending ? colors.accent : 'transparent' },
                  ]}
                  onPress={() => setPendingDevice(device)}
                >
                  <View style={styles.deviceItemText}>
                    <Text style={[styles.deviceName, { color: colors.text }]}>{device.name}</Text>
                    <Text style={[styles.deviceAddress, { color: colors.textMuted }]}>{device.address}</Text>
                    <View style={styles.metaRow}>
                      {device.isPaired ? (
                        <Text style={[styles.deviceMetaText, { color: colors.success }]}>Paired</Text>
                      ) : null}
                      {typeof device.rssi === 'number' ? (
                        <Text style={[styles.deviceMetaText, { color: colors.textMuted }]}>RSSI {device.rssi} dBm</Text>
                      ) : null}
                      {formatLastSeenLabel(device.lastSeenAt) ? (
                        <Text style={[styles.deviceMetaText, { color: colors.textMuted }]}>
                          Last seen {formatLastSeenLabel(device.lastSeenAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {isSaved ? <Text style={[styles.selectedText, { color: colors.success }]}>Saved</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {connectionResult ? (
            <View
              style={[
                styles.scanStateContainer,
                {
                  backgroundColor:
                    connectionResult.status === 'connected' ? colors.success + '15' : colors.error + '10',
                },
              ]}
            >
              <Text
                style={[
                  styles.scanStateErrorText,
                  {
                    color: connectionResult.status === 'connected' ? colors.success : colors.error,
                  },
                ]}
              >
                {connectionResult.message}
              </Text>
            </View>
          ) : null}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => void runBluetoothScan()}>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                Scan Again ({Math.round(scanDurationMs / 1000)}s)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: pendingDevice ? colors.accent : colors.surfaceSecondary }]}
              onPress={() => void confirmDevice()}
              disabled={!pendingDevice || isValidatingConnection}
            >
              {isValidatingConnection ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.actionButtonText, { color: pendingDevice ? '#fff' : colors.textMuted }]}>Confirm Device</Text>
              )}
            </TouchableOpacity>
          </View>

          {selectedDevice && onRemoveDevice ? (
            <TouchableOpacity style={[styles.removeButton, { backgroundColor: colors.error + '15' }]} onPress={onRemoveDevice}>
              <Text style={[styles.actionButtonText, { color: colors.error }]}>Remove Current Device</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  bluetoothSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '75%',
    gap: 10,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 999, alignSelf: 'center', marginBottom: 2 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetSubtitle: { fontSize: 14, marginBottom: 4 },
  scanStateContainer: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanStateText: { fontSize: 14, flex: 1 },
  scanStateErrorText: { fontSize: 14, flex: 1, fontWeight: '600' },
  scanResultsList: { maxHeight: 260 },
  scanResultsContent: { gap: 8, paddingBottom: 4 },
  scanControls: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  scanControlsTitle: { fontSize: 13, fontWeight: '700' },
  durationOptions: { flexDirection: 'row', gap: 8 },
  durationOption: { borderRadius: 999, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 10 },
  durationOptionText: { fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 13, fontWeight: '500' },
  deviceItem: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceItemText: { flex: 1, gap: 2 },
  deviceName: { fontSize: 15, fontWeight: '600' },
  deviceAddress: { fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deviceMetaText: { fontSize: 12, fontWeight: '500' },
  selectedText: { fontSize: 12, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  removeButton: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
