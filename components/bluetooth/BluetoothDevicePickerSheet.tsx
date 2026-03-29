import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BluetoothScanResult, scanBluetoothDevices } from '@/services/bluetooth';
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

  const runBluetoothScan = useCallback(async () => {
    setIsScanningBluetooth(true);
    setScanResult(null);

    const result = await scanBluetoothDevices({ timeoutMs: 10_000, retries: 1 });
    setScanResult(result);
    setIsScanningBluetooth(false);
  }, []);

  useEffect(() => {
    if (!visible) return;

    setPendingDevice(selectedDevice);
    void runBluetoothScan();
  }, [visible, selectedDevice, runBluetoothScan]);

  const hasScanError = Boolean(
    scanResult && ['permission-denied', 'unsupported', 'error', 'timeout'].includes(scanResult.status)
  );

  const scannedDevices = useMemo(() => scanResult?.devices ?? [], [scanResult?.devices]);

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
                  </View>
                  {isSaved ? <Text style={[styles.selectedText, { color: colors.success }]}>Saved</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => void runBluetoothScan()}>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Scan Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: pendingDevice ? colors.accent : colors.surfaceSecondary }]}
              onPress={() => pendingDevice && onConfirmDevice(pendingDevice)}
              disabled={!pendingDevice}
            >
              <Text style={[styles.actionButtonText, { color: pendingDevice ? '#fff' : colors.textMuted }]}>Confirm Device</Text>
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
  selectedText: { fontSize: 12, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  removeButton: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
