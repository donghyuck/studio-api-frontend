// src/react-components/toast/ToastHost.tsx
import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useToast } from './useToast';

export const ToastHost: React.FC = () => {
  const { currentToast, hideToast } = useToast();

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    if (currentToast) {
      hideToast(currentToast.id);
    }
  };

  return (
    <Snackbar
      open={currentToast?.open || false}
      autoHideDuration={currentToast?.autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }} // Matches Vue's 'top right'
    >
      {currentToast ? (
        <Alert
          onClose={handleClose}
          severity={currentToast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {currentToast.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
};
