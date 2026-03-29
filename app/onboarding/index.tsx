import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Bluetooth, Check, MapPin, Bell, ChevronRight } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { AppCard } from '@/components/ui/primitives';
import { useParking, CarBluetoothDevice } from '@/context/ParkingContext';
import { requestBluetoothPermissions } from '@/services/bluetooth';
import { BluetoothDevicePickerSheet } from '@/components/bluetooth/BluetoothDevicePickerSheet';
import { completeOnboarding, clearSkippedBluetoothSetup } from '@/services/onboarding';

export default function OnboardingScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const {
    permissionStatuses,
    refreshPermissionStatuses,
    requestNotificationAccess,
    savedBluetoothDevice,
    setSavedBluetoothDevice,
    setAutoDetectionEnabled,
  } = useParking();

  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);

  const permissionsReady = useMemo(
    () => permissionStatuses.location.foreground === 'granted' && permissionStatuses.bluetooth === 'granted',
    [permissionStatuses.bluetooth, permissionStatuses.location.foreground]
  );

  const handleRequestLocation = useCallback(async () => {
    await Location.requestForegroundPermissionsAsync();
    await refreshPermissionStatuses();
  }, [refreshPermissionStatuses]);

  const handleRequestBluetooth = useCallback(async () => {
    await requestBluetoothPermissions();
    await refreshPermissionStatuses();
  }, [refreshPermissionStatuses]);

  const handleRequestNotifications = useCallback(async () => {
    await requestNotificationAccess();
    await refreshPermissionStatuses();
  }, [refreshPermissionStatuses, requestNotificationAccess]);

  const finishOnboarding = useCallback(async (skippedBluetoothSetup: boolean) => {
    await completeOnboarding({ skippedBluetoothSetup });
    if (skippedBluetoothSetup) {
      await setAutoDetectionEnabled(false);
    }
    router.replace('/(tabs)');
  }, [router, setAutoDetectionEnabled]);

  const handleConfirmDevice = useCallback(async (device: CarBluetoothDevice) => {
    setSavedBluetoothDevice(device);
    await setAutoDetectionEnabled(true);
    await clearSkippedBluetoothSetup();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPickerVisible(false);
  }, [setAutoDetectionEnabled, setSavedBluetoothDevice]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {step === 0 ? (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Welcome to CarPing 👋</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Save your parking spot instantly and find your car without stress.</Text>
            <AppCard colors={colors} style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>What you get</Text>
              <Text style={[styles.bullet, { color: colors.textMuted }]}>• One-tap parking saves</Text>
              <Text style={[styles.bullet, { color: colors.textMuted }]}>• Car location + walking distance</Text>
              <Text style={[styles.bullet, { color: colors.textMuted }]}>• Optional auto-save via Bluetooth disconnect</Text>
            </AppCard>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Permissions</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>We only request what is needed to save and detect your parked car.</Text>

            <PermissionRow label="Location" icon={<MapPin size={18} color={colors.accent} />} granted={permissionStatuses.location.foreground === 'granted'} onPress={handleRequestLocation} colors={colors} />
            <PermissionRow label="Bluetooth" icon={<Bluetooth size={18} color={colors.accent} />} granted={permissionStatuses.bluetooth === 'granted'} onPress={handleRequestBluetooth} colors={colors} />
            <PermissionRow label="Notifications (optional)" icon={<Bell size={18} color={colors.accent} />} granted={['granted', 'limited'].includes(permissionStatuses.notifications)} onPress={handleRequestNotifications} colors={colors} />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Select your car Bluetooth</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Choose and confirm your car device to enable automatic parking detection.</Text>

            <TouchableOpacity style={[styles.selectButton, { backgroundColor: colors.card }]} onPress={() => setPickerVisible(true)}>
              <Text style={[styles.selectButtonTitle, { color: colors.text }]}>{savedBluetoothDevice ? savedBluetoothDevice.name : 'Pick Bluetooth Device'}</Text>
              <ChevronRight size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {savedBluetoothDevice ? (
              <Text style={[styles.confirmedText, { color: colors.success }]}>Confirmed: {savedBluetoothDevice.address}</Text>
            ) : (
              <Text style={[styles.confirmedText, { color: colors.textMuted }]}>You can skip and configure this later in Settings.</Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom + 12, 24) }] }>
        {step < 2 ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={() => setStep((current) => current + 1)}
            disabled={step === 1 && !permissionsReady}
          >
            <Text style={styles.primaryButtonText}>{step === 1 ? 'Continue to device setup' : 'Get started'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: savedBluetoothDevice ? colors.accent : colors.surfaceSecondary }]}
              onPress={() => void finishOnboarding(false)}
              disabled={!savedBluetoothDevice}
            >
              <Text style={[styles.primaryButtonText, { color: savedBluetoothDevice ? '#fff' : colors.textMuted }]}>Finish onboarding</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={() => void finishOnboarding(true)}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <BluetoothDevicePickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        selectedDevice={savedBluetoothDevice}
        onConfirmDevice={(device) => void handleConfirmDevice(device)}
        onRemoveDevice={() => setSavedBluetoothDevice(null)}
        colors={colors}
      />
    </SafeAreaView>
  );
}

function PermissionRow({
  label,
  icon,
  granted,
  onPress,
  colors,
}: {
  label: string;
  icon: React.ReactNode;
  granted: boolean;
  onPress: () => void;
  colors: typeof Colors.light | typeof Colors.dark;
}) {
  return (
    <TouchableOpacity style={[styles.permissionRow, { backgroundColor: colors.card }]} onPress={() => void onPress()}>
      <View style={styles.permissionLabel}>
        {icon}
        <Text style={[styles.permissionText, { color: colors.text }]}>{label}</Text>
      </View>
      {granted ? <Check size={18} color={colors.success} /> : <Text style={[styles.requestText, { color: colors.accent }]}>Request</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  stepContainer: { gap: 14 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: { borderRadius: 18, padding: 18, gap: 8 },
  cardTitle: { fontWeight: '700', fontSize: 17 },
  bullet: { fontSize: 14 },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  permissionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permissionText: { fontSize: 15, fontWeight: '600' },
  requestText: { fontSize: 14, fontWeight: '700' },
  actions: { paddingHorizontal: 20, gap: 10 },
  primaryButton: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  skipButton: { alignItems: 'center', paddingVertical: 6 },
  skipText: { fontSize: 14, fontWeight: '600' },
  selectButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonTitle: { fontSize: 15, fontWeight: '600' },
  confirmedText: { fontSize: 13 },
});
