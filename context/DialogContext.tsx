import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { SelectionItem, SelectionSheet } from '@/components/dialogs/SelectionSheet';
import { Colors } from '@/constants/colors';
import { DIALOG_COPY, DialogAction, DialogVariant } from '@/constants/dialogs';
import { useTheme } from '@/context/ThemeContext';

type ConfirmVariant = Extract<DialogVariant, 'error' | 'confirm' | 'destructive' | 'info'>;

interface ConfirmPayload {
  type: 'confirm';
  variant: ConfirmVariant;
  title: string;
  message?: string;
  actions: DialogAction[];
  onAction?: (action: DialogAction) => void;
  accessibilityLabel: string;
}

interface PickerPayload {
  type: 'picker';
  title: string;
  message?: string;
  items: SelectionItem[];
  accessibilityLabel: string;
  onSelect: (id: string) => void;
}

type DialogPayload = ConfirmPayload | PickerPayload;

interface DialogApi {
  showError: (title: string, message?: string, onClose?: () => void) => void;
  showInfo: (title: string, message?: string, onClose?: () => void) => void;
  showConfirm: (config: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }) => void;
  showDestructive: (config: {
    title: string;
    message?: string;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }) => void;
  showPicker: (config: {
    title: string;
    message?: string;
    items: SelectionItem[];
    onSelect: (id: string) => void;
  }) => void;
  dismissDialog: () => void;
}

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const [dialog, setDialog] = useState<DialogPayload | null>(null);

  const dismissDialog = useCallback(() => setDialog(null), []);

  const showError = useCallback((title: string, message?: string, onClose?: () => void) => {
    setDialog({
      type: 'confirm',
      variant: 'error',
      title,
      message,
      actions: [DIALOG_COPY.actions.ok],
      onAction: () => onClose?.(),
      accessibilityLabel: `${title}. ${message ?? ''}`.trim(),
    });
  }, []);

  const showInfo = useCallback((title: string, message?: string, onClose?: () => void) => {
    setDialog({
      type: 'confirm',
      variant: 'info',
      title,
      message,
      actions: [DIALOG_COPY.actions.ok],
      onAction: () => onClose?.(),
      accessibilityLabel: `${title}. ${message ?? ''}`.trim(),
    });
  }, []);

  const showConfirm = useCallback((config: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }) => {
    setDialog({
      type: 'confirm',
      variant: 'confirm',
      title: config.title,
      message: config.message,
      actions: [
        { ...DIALOG_COPY.actions.cancel, label: config.cancelLabel ?? DIALOG_COPY.actions.cancel.label },
        { id: 'confirm', label: config.confirmLabel ?? 'Continue', role: 'default' },
      ],
      onAction: (action) => {
        if (action.id === 'confirm') config.onConfirm();
      },
      accessibilityLabel: `${config.title}. ${config.message ?? ''}`.trim(),
    });
  }, []);

  const showDestructive = useCallback((config: {
    title: string;
    message?: string;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }) => {
    setDialog({
      type: 'confirm',
      variant: 'destructive',
      title: config.title,
      message: config.message,
      actions: [
        { ...DIALOG_COPY.actions.cancel, label: config.cancelLabel ?? DIALOG_COPY.actions.cancel.label },
        { id: 'destructive', label: config.confirmLabel, role: 'destructive' },
      ],
      onAction: (action) => {
        if (action.id === 'destructive') config.onConfirm();
      },
      accessibilityLabel: `${config.title}. ${config.message ?? ''}`.trim(),
    });
  }, []);

  const showPicker = useCallback((config: {
    title: string;
    message?: string;
    items: SelectionItem[];
    onSelect: (id: string) => void;
  }) => {
    setDialog({
      type: 'picker',
      title: config.title,
      message: config.message,
      items: config.items,
      onSelect: config.onSelect,
      accessibilityLabel: `${config.title}. ${config.message ?? ''}`.trim(),
    });
  }, []);

  const onConfirmAction = useCallback((action: DialogAction) => {
    if (dialog?.type !== 'confirm') return;
    dialog.onAction?.(action);
    dismissDialog();
  }, [dialog, dismissDialog]);

  const onPickerSelect = useCallback((id: string) => {
    if (dialog?.type !== 'picker') return;
    dialog.onSelect(id);
    dismissDialog();
  }, [dialog, dismissDialog]);

  const value = useMemo<DialogApi>(
    () => ({ showError, showInfo, showConfirm, showDestructive, showPicker, dismissDialog }),
    [dismissDialog, showConfirm, showDestructive, showError, showInfo, showPicker]
  );

  return (
    <DialogContext.Provider value={value}>
      {children}

      {dialog?.type === 'confirm' ? (
        <ConfirmDialog
          visible
          variant={dialog.variant}
          title={dialog.title}
          description={dialog.message}
          actions={dialog.actions}
          colors={colors}
          onAction={onConfirmAction}
          onDismiss={dismissDialog}
          accessibilityLabel={dialog.accessibilityLabel}
        />
      ) : null}

      {dialog?.type === 'picker' ? (
        <SelectionSheet
          visible
          title={dialog.title}
          description={dialog.message}
          items={dialog.items}
          colors={colors}
          onSelect={onPickerSelect}
          onDismiss={dismissDialog}
          accessibilityLabel={dialog.accessibilityLabel}
        />
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return context;
}
