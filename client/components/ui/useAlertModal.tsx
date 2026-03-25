'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertModal, type AlertType } from './AlertModal';

type AlertState = {
  isOpen: boolean;
  title?: string;
  message: string;
  type: AlertType;
  confirmText?: string;
  cancelText?: string;
  dangerConfirm?: boolean;
  confirmMode: boolean;
};

export function useAlertModal() {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    message: '',
    type: 'info',
    confirmMode: false,
  });
  const onAfterCloseRef = useRef<(() => void) | undefined>(undefined);
  const onConfirmRef = useRef<(() => void | Promise<void>) | undefined>(undefined);

  const close = useCallback(() => {
    const fn = onAfterCloseRef.current;
    onAfterCloseRef.current = undefined;
    onConfirmRef.current = undefined;
    setState((s) => ({ ...s, isOpen: false, confirmMode: false }));
    fn?.();
  }, []);

  const showAlert = useCallback(
    (
      message: string,
      type: AlertType = 'info',
      title?: string,
      confirmText = 'OK',
      onAfterClose?: () => void
    ) => {
      onConfirmRef.current = undefined;
      onAfterCloseRef.current = onAfterClose;
      setState({
        isOpen: true,
        message,
        type,
        title,
        confirmText,
        cancelText: undefined,
        dangerConfirm: false,
        confirmMode: false,
      });
    },
    []
  );

  const showConfirm = useCallback(
    (
      message: string,
      onConfirm: () => void | Promise<void>,
      opts?: {
        title?: string;
        confirmText?: string;
        cancelText?: string;
        type?: AlertType;
        dangerConfirm?: boolean;
      }
    ) => {
      onAfterCloseRef.current = undefined;
      onConfirmRef.current = onConfirm;
      setState({
        isOpen: true,
        message,
        type: opts?.type ?? 'warning',
        title: opts?.title,
        confirmText: opts?.confirmText ?? 'Confirm',
        cancelText: opts?.cancelText ?? 'Cancel',
        dangerConfirm: opts?.dangerConfirm ?? false,
        confirmMode: true,
      });
    },
    []
  );

  const handleConfirmAction = useCallback(async () => {
    const fn = onConfirmRef.current;
    onConfirmRef.current = undefined;
    if (fn) await fn();
  }, []);

  const alertModal = useMemo(
    () => (
      <AlertModal
        isOpen={state.isOpen}
        onClose={close}
        title={state.title}
        message={state.message}
        type={state.type}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        dangerConfirm={state.dangerConfirm}
        onConfirm={state.confirmMode ? handleConfirmAction : undefined}
      />
    ),
    [
      state.isOpen,
      state.message,
      state.type,
      state.title,
      state.confirmText,
      state.cancelText,
      state.dangerConfirm,
      state.confirmMode,
      close,
      handleConfirmAction,
    ]
  );

  return { showAlert, showConfirm, close, alertModal };
}
