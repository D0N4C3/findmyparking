import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingState {
  completed: boolean;
  skippedBluetoothSetup: boolean;
}

const ONBOARDING_STORAGE_KEY = '@parkping/onboarding_state';

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed: false,
  skippedBluetoothSetup: false,
};

export const getOnboardingState = async (): Promise<OnboardingState> => {
  const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);

  if (!raw) {
    return DEFAULT_ONBOARDING_STATE;
  }

  try {
    return {
      ...DEFAULT_ONBOARDING_STATE,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
};

export const setOnboardingState = async (state: OnboardingState) => {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
};

export const completeOnboarding = async ({ skippedBluetoothSetup }: { skippedBluetoothSetup: boolean }) => {
  await setOnboardingState({ completed: true, skippedBluetoothSetup });
};

export const clearSkippedBluetoothSetup = async () => {
  const state = await getOnboardingState();
  await setOnboardingState({ ...state, completed: true, skippedBluetoothSetup: false });
};
