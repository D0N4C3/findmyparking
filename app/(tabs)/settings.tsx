import { useParking, CarBluetoothDevice } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';
import {
  PERMISSION_STATUS_LABELS,
  PermissionBadgeStatus,
} from '@/services/permissions';
import { 
  Bluetooth, 
  MapPin, 
  Bell, 
  Trash2, 
  ChevronRight,
  Info,
  Shield,
  Navigation,
  Moon,
  Sun,
  Smartphone,
  Car,
  Clock,
  Award,
  Heart,
  Share2
} from 'lucide-react-native';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Switch,
  Linking,
  Animated,
  Share,
  ActivityIndicator,
  Modal,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { AppCard, SectionHeader } from '@/components/ui/primitives';
import { useDialog } from '@/context/DialogContext';
import { DIALOG_COPY } from '@/constants/dialogs';
import { BluetoothScanResult, scanBluetoothDevices } from '@/services/bluetooth';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  colors: typeof Colors.light | typeof Colors.dark;
  destructive?: boolean;
}

function SettingItem({ icon, title, subtitle, onPress, rightElement, colors, destructive }: SettingItemProps) {
  return (
    <TouchableOpacity 
      style={[styles.settingItem, { backgroundColor: colors.card }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { 
        backgroundColor: destructive ? colors.error + '15' : colors.accent + '15' 
      }]}>
        {icon}
      </View>
      
      <View style={styles.itemContent}>
        <Text style={[
          styles.itemTitle, 
          { color: destructive ? colors.error : colors.text }
        ]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement || (onPress && (
        <ChevronRight size={20} color={colors.textMuted} />
      ))}
    </TouchableOpacity>
  );
}

interface ThemeOptionProps {
  icon: React.ReactNode;
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: typeof Colors.light | typeof Colors.dark;
}

function ThemeOption({ icon, label, isSelected, onPress, colors }: ThemeOptionProps) {
  return (
    <TouchableOpacity
      style={[
        styles.themeOption,
        { 
          backgroundColor: isSelected ? colors.accent + '20' : colors.surfaceSecondary,
          borderColor: isSelected ? colors.accent : 'transparent',
          borderWidth: 2
        }
      ]}
      onPress={onPress}
    >
      {icon}
      <Text style={[
        styles.themeLabel,
        { color: isSelected ? colors.accent : colors.text }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { 
    savedBluetoothDevice, 
    setSavedBluetoothDevice, 
    isAutoDetectionEnabled, 
    setAutoDetectionEnabled,
    clearHistory,
    parkingStats,
    permissionStatuses,
    refreshPermissionStatuses,
    requestNotificationAccess,
  } = useParking();
  const { isDark, theme, setTheme } = useTheme();
  const { showDestructive, showError, showConfirm } = useDialog();
  const colors = isDark ? Colors.dark : Colors.light;
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isBluetoothModalVisible, setIsBluetoothModalVisible] = useState(false);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [scanResult, setScanResult] = useState<BluetoothScanResult | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const runBluetoothScan = useCallback(async () => {
    setIsScanningBluetooth(true);
    setScanResult(null);

    const result = await scanBluetoothDevices({
      timeoutMs: 10_000,
      retries: 1,
    });

    setScanResult(result);
    setIsScanningBluetooth(false);
  }, []);

  const handleSelectBluetoothDevice = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsBluetoothModalVisible(true);
    void runBluetoothScan();
  }, [runBluetoothScan]);

  const handleSelectScannedDevice = useCallback((device: CarBluetoothDevice) => {
    setSavedBluetoothDevice(device);
    setIsBluetoothModalVisible(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [setSavedBluetoothDevice]);

  const handleRemoveSavedDevice = useCallback(() => {
    setSavedBluetoothDevice(null);
    setIsBluetoothModalVisible(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [setSavedBluetoothDevice]);

  const handleClearAllData = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    showDestructive({
      title: DIALOG_COPY.prompts.clearAllData.title,
      message: DIALOG_COPY.prompts.clearAllData.message,
      confirmLabel: DIALOG_COPY.actions.clearAll.label,
      onConfirm: () => {
        clearHistory();
        setSavedBluetoothDevice(null);
        setAutoDetectionEnabled(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    });
  }, [clearHistory, setAutoDetectionEnabled, setSavedBluetoothDevice, showDestructive]);

  const handleOpenPermissions = useCallback(() => {
    void Linking.openSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPermissionStatuses();
    }, [refreshPermissionStatuses])
  );

  const handleShareApp = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out ParkPing - Never forget where you parked again!',
        title: 'ParkPing',
      });
    } catch {
      showError(DIALOG_COPY.errors.shareApp.title, DIALOG_COPY.errors.shareApp.message);
    }
  }, [showError]);

  const handleToggleAutoDetection = useCallback((value: boolean) => {
    if (value && !savedBluetoothDevice) {
      showConfirm({
        title: 'Select a Bluetooth device first',
        message: 'Pick your car Bluetooth device so ParkPing knows what to monitor.',
        confirmLabel: 'Select Device',
        onConfirm: handleSelectBluetoothDevice,
      });
      setAutoDetectionEnabled(false);
      return;
    }

    setAutoDetectionEnabled(value);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [handleSelectBluetoothDevice, savedBluetoothDevice, setAutoDetectionEnabled, showConfirm]);

  const handleToggleNotifications = useCallback((value: boolean) => {
    if (value) {
      void requestNotificationAccess();
    } else {
      showConfirm({
        title: DIALOG_COPY.permissions.notificationsSettings.title,
        message: DIALOG_COPY.permissions.notificationsSettings.message,
        confirmLabel: DIALOG_COPY.actions.openSettings.label,
        onConfirm: handleOpenPermissions,
      });
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [handleOpenPermissions, requestNotificationAccess, showConfirm]);

  const handleToggleSound = useCallback((value: boolean) => {
    setSoundEnabled(value);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const getPermissionBadgeColors = useCallback((status: PermissionBadgeStatus) => {
    switch (status) {
      case 'granted':
        return { text: colors.success, background: colors.success + '20' };
      case 'denied':
        return { text: colors.error, background: colors.error + '20' };
      case 'limited':
        return { text: colors.warning, background: colors.warning + '20' };
      case 'not-requested':
      default:
        return { text: colors.textMuted, background: colors.surfaceSecondary };
    }
  }, [colors]);

  const locationStatus: PermissionBadgeStatus =
    permissionStatuses.location.foreground === 'granted'
      ? permissionStatuses.location.background
      : permissionStatuses.location.foreground;
  const scannedDevices = scanResult?.devices ?? [];
  const hasScanError = Boolean(
    scanResult && ['permission-denied', 'unsupported', 'error', 'timeout'].includes(scanResult.status)
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <SectionHeader
        colors={colors}
        title="Settings"
        subtitle="Customize your experience"
        style={styles.header}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{
          opacity: slideAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })
          }]
        }}>
          {/* Stats Card */}
          {parkingStats.totalParkings > 0 && (
            <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
              <LinearGradient
                colors={colors.accentGradient}
                style={styles.statsGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.statItem}>
                  <Car size={24} color="#FFFFFF" />
                  <Text style={styles.statValue}>{parkingStats.totalParkings}</Text>
                  <Text style={styles.statLabel}>Parkings</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Clock size={24} color="#FFFFFF" />
                  <Text style={styles.statValue}>{parkingStats.lastWeekParkings}</Text>
                  <Text style={styles.statLabel}>This Week</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Award size={24} color="#FFFFFF" />
                  <Text style={styles.statValue}>{Math.min(parkingStats.totalParkings, 99)}</Text>
                  <Text style={styles.statLabel}>Level</Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>
            
            <AppCard colors={colors} style={styles.themeSelector} elevated="none">
              <Text style={[styles.themeSelectorTitle, { color: colors.text }]}>Theme</Text>
              <View style={styles.themeOptions}>
                <ThemeOption
                  icon={<Sun size={20} color={theme === 'light' ? colors.accent : colors.textMuted} />}
                  label="Light"
                  isSelected={theme === 'light'}
                  onPress={() => setTheme('light')}
                  colors={colors}
                />
                <ThemeOption
                  icon={<Moon size={20} color={theme === 'dark' ? colors.accent : colors.textMuted} />}
                  label="Dark"
                  isSelected={theme === 'dark'}
                  onPress={() => setTheme('dark')}
                  colors={colors}
                />
                <ThemeOption
                  icon={<Smartphone size={20} color={theme === 'system' ? colors.accent : colors.textMuted} />}
                  label="Auto"
                  isSelected={theme === 'system'}
                  onPress={() => setTheme('system')}
                  colors={colors}
                />
              </View>
            </AppCard>
          </View>

          {/* Auto Detection Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>AUTO DETECTION</Text>
            
            <SettingItem
              icon={<Bluetooth size={22} color={colors.accent} />}
              title="Bluetooth Auto-Detection"
              subtitle={savedBluetoothDevice 
                ? `Connected to ${savedBluetoothDevice.name}` 
                : 'No device selected'}
              onPress={handleSelectBluetoothDevice}
              colors={colors}
            />

            <AppCard colors={colors} style={styles.switchItem} elevated="none">
              <View style={styles.switchLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.success + '15' }]}>
                  <Navigation size={22} color={colors.success} />
                </View>
                <View>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>Enable Auto-Detection</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                    Save location on Bluetooth disconnect
                  </Text>
                </View>
              </View>
              <Switch
                value={isAutoDetectionEnabled}
                onValueChange={handleToggleAutoDetection}
                trackColor={{ false: colors.surfaceSecondary, true: colors.accent + '50' }}
                thumbColor={isAutoDetectionEnabled ? colors.accent : colors.textMuted}
              />
            </AppCard>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>NOTIFICATIONS</Text>
            
            <AppCard colors={colors} style={styles.switchItem} elevated="none">
              <View style={styles.switchLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.warning + '15' }]}>
                  <Bell size={22} color={colors.warning} />
                </View>
                <View>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>Parking Reminders</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                    Get notified when you park
                  </Text>
                </View>
              </View>
              <Switch
                value={
                  permissionStatuses.notifications === 'granted' ||
                  permissionStatuses.notifications === 'limited'
                }
                onValueChange={handleToggleNotifications}
                trackColor={{ false: colors.surfaceSecondary, true: colors.accent + '50' }}
                thumbColor={
                  permissionStatuses.notifications === 'granted' ||
                  permissionStatuses.notifications === 'limited'
                    ? colors.accent
                    : colors.textMuted
                }
              />
            </AppCard>

            <AppCard colors={colors} style={styles.switchItem} elevated="none">
              <View style={styles.switchLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
                  <Navigation size={22} color={colors.accent} />
                </View>
                <View>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>Sound Effects</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                    Play sounds for actions
                  </Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={handleToggleSound}
                trackColor={{ false: colors.surfaceSecondary, true: colors.accent + '50' }}
                thumbColor={soundEnabled ? colors.accent : colors.textMuted}
              />
            </AppCard>
          </View>

          {/* Permissions Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PERMISSIONS</Text>
            
            <SettingItem
              icon={<MapPin size={22} color={colors.accent} />}
              title="Location Services"
              subtitle="Required for saving parking spots"
              onPress={handleOpenPermissions}
              colors={colors}
              rightElement={
                <View style={[styles.badge, { backgroundColor: getPermissionBadgeColors(locationStatus).background }]}>
                  <Text style={[styles.badgeText, { color: getPermissionBadgeColors(locationStatus).text }]}>
                    {PERMISSION_STATUS_LABELS[locationStatus]}
                  </Text>
                </View>
              }
            />

            <SettingItem
              icon={<Bluetooth size={22} color={colors.accent} />}
              title="Bluetooth Access"
              subtitle="Required for auto-detection"
              onPress={handleOpenPermissions}
              colors={colors}
              rightElement={
                <View style={[styles.badge, { backgroundColor: getPermissionBadgeColors(permissionStatuses.bluetooth).background }]}>
                  <Text style={[styles.badgeText, { color: getPermissionBadgeColors(permissionStatuses.bluetooth).text }]}>
                    {PERMISSION_STATUS_LABELS[permissionStatuses.bluetooth]}
                  </Text>
                </View>
              }
            />

            <SettingItem
              icon={<Bell size={22} color={colors.accent} />}
              title="Notification Access"
              subtitle="Required for parking reminders"
              onPress={handleOpenPermissions}
              colors={colors}
              rightElement={
                <View style={[styles.badge, { backgroundColor: getPermissionBadgeColors(permissionStatuses.notifications).background }]}>
                  <Text style={[styles.badgeText, { color: getPermissionBadgeColors(permissionStatuses.notifications).text }]}>
                    {PERMISSION_STATUS_LABELS[permissionStatuses.notifications]}
                  </Text>
                </View>
              }
            />
          </View>

          {/* Data Management Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DATA MANAGEMENT</Text>
            
            <SettingItem
              icon={<Share2 size={22} color={colors.accent} />}
              title="Share ParkPing"
              subtitle="Tell your friends about the app"
              onPress={handleShareApp}
              colors={colors}
            />

            <SettingItem
              icon={<Trash2 size={22} color={colors.error} />}
              title="Clear All Data"
              subtitle="Delete all history and settings"
              onPress={handleClearAllData}
              colors={colors}
              destructive
            />
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ABOUT</Text>
            
            <SettingItem
              icon={<Info size={22} color={colors.accent} />}
              title="About ParkPing"
              subtitle="Version 1.0.0"
              colors={colors}
            />

            <SettingItem
              icon={<Shield size={22} color={colors.accent} />}
              title="Privacy Policy"
              onPress={() => Linking.openURL('https://parkping.app/privacy')}
              colors={colors}
            />

            <SettingItem
              icon={<Heart size={22} color={colors.accent} />}
              title="Rate ParkPing"
              onPress={() => Linking.openURL('https://apps.apple.com')}
              colors={colors}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              ParkPing v1.0.0
            </Text>
            <Text style={[styles.footerSubtext, { color: colors.textMuted }]}>
              Never forget where you parked
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={isBluetoothModalVisible}
        onRequestClose={() => setIsBluetoothModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsBluetoothModalVisible(false)} />
          <View style={[styles.bluetoothSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Car Bluetooth Device</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>Nearby and paired devices</Text>

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

            {!isScanningBluetooth && scanResult?.status === 'empty' ? (
              <View style={[styles.scanStateContainer, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.scanStateText, { color: colors.textMuted }]}>{scanResult.message}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.scanResultsList} contentContainerStyle={styles.scanResultsContent}>
              {scannedDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={[styles.deviceItem, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => handleSelectScannedDevice(device)}
                >
                  <View style={styles.deviceItemText}>
                    <Text style={[styles.deviceName, { color: colors.text }]}>{device.name}</Text>
                    <Text style={[styles.deviceAddress, { color: colors.textMuted }]}>{device.address}</Text>
                  </View>
                  {savedBluetoothDevice?.id === device.id ? (
                    <Text style={[styles.selectedText, { color: colors.success }]}>Selected</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => void runBluetoothScan()}
              >
                <Text style={[styles.actionButtonText, { color: colors.text }]}>Scan Again</Text>
              </TouchableOpacity>

              {savedBluetoothDevice ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
                  onPress={handleRemoveSavedDevice}
                >
                  <Text style={[styles.actionButtonText, { color: colors.error }]}>Remove Device</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  statsCard: {
    borderRadius: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  statsGradient: {
    flexDirection: 'row',
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  themeSelector: {
    padding: 16,
    borderRadius: 20,
  },
  themeSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bluetoothSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '75%',
    gap: 10,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 2,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  scanStateContainer: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanStateText: {
    fontSize: 14,
    flex: 1,
  },
  scanStateErrorText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '600',
  },
  scanResultsList: {
    maxHeight: 260,
  },
  scanResultsContent: {
    gap: 8,
    paddingBottom: 4,
  },
  deviceItem: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceItemText: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  deviceAddress: {
    fontSize: 13,
  },
  selectedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
