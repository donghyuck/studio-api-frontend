// src/react-components/auth/PasswordResetDialog.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  DialogActions,
  Button,
  CircularProgress,
  Box,
  Alert,
  AlertTitle,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

// Mocked imports for API and Toast, assuming they are ported or will be
// import { requestPasswordReset } from '@/data/studio/auth/auth-service'; // Placeholder
// import { useToast } from '@/react-components/toast/useToast'; // Assuming useToast is available

interface PasswordResetDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FormData {
  email: string;
}

const emailSchema = yup.object({
  email: yup.string().required('이메일을 입력해주세요.').email('올바른 이메일 형식이 아닙니다.'),
}).required();

// Mock requestPasswordReset and useToast for now
const requestPasswordReset = async (email: string) => {
  console.log(`Requesting password reset for: ${email}`);
  return new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call
};

const useToast = () => ({
  success: (message: string) => console.log('Toast Success:', message),
  error: (message: string) => console.error('Toast Error:', message),
});
// End Mock

export const PasswordResetDialog: React.FC<PasswordResetDialogProps> = ({ open, onClose }) => {
  const { control, handleSubmit, formState: { errors }, reset, watch } = useForm<FormData>({
    resolver: yupResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const emailValue = watch('email'); // Watch email for immediate validation feedback if desired

  useEffect(() => {
    if (!open) {
      reset({ email: '' }); // Reset form when dialog closes
      setLoading(false);
    }
  }, [open, reset]);

  const onSubmit = useCallback(async (data: FormData) => {
    setLoading(true);
    try {
      await requestPasswordReset(data.email);
      toast.success('비밀번호 재설정 메일이 발송되었습니다.');
      onClose();
    } catch (e: any) {
      toast.error(e.message || '비밀번호 재설정 메일 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [onClose, toast]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>비밀번호 재설정</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          <AlertTitle>정보</AlertTitle>
          비밀번호 재설정을 위한 확인 메일을 발송합니다.<br />
          입력하신 이메일로 전송된 링크를 통해 비밀번호를 다시 설정할 수 있습니다.
        </Alert>
        <form id="password-reset-form" onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="이메일"
                type="email"
                fullWidth
                variant="outlined"
                error={!!errors.email}
                helperText={errors.email?.message}
                margin="normal"
              />
            )}
          />
        </form>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={loading} sx={{ width: 100 }}>
          닫기
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          type="submit"
          form="password-reset-form"
          variant="contained"
          color="primary"
          disabled={loading}
          sx={{ width: 140 }}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          재설정 메일 보내기
        </Button>
      </DialogActions>
    </Dialog>
  );
};
