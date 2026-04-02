// src/react-components/auth/LoginForm.tsx
import React, { useState, useCallback } from 'react';
import {
  TextField,
  Button,
  Grid,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { PasswordResetDialog } from './PasswordResetDialog'; // Assuming this path

// Mock useAuthStore and useRouter for now
// Phase 3 will provide actual auth context/Zustand store
const useAuthStore = () => ({
  login: async (username: string, password: string) => {
    console.log(`Mock Login: ${username} / ${password}`);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (username === 'user' && password === 'password') {
          resolve({});
        } else {
          reject(new Error('아이디 또는 비밀번호가 올바르지 않습니다.'));
        }
      }, 1000);
    });
  },
});

// Phase 2 will provide actual react-router-dom
const useRouter = () => ({
  push: (path: string) => console.log(`Mock Router Push: ${path}`),
});

interface FormData {
  username: string;
  password: string;
}

const schema = yup.object({
  username: yup.string().required('아이디를 입력하세요'),
  password: yup
    .string()
    .min(6, '비밀번호는 최소 6자 이상입니다')
    .required('비밀번호를 입력하세요'),
}).required();

export const LoginForm: React.FC = () => {
  const { control, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const auth = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPasswordResetDialogOpen, setIsPasswordResetDialogOpen] = useState(false);

  const handleLogin = useCallback(async (data: FormData) => {
    setLoading(true);
    setErrorMessage('');
    try {
      // localStorage 'remember_device' logic can be added here if needed
      await auth.login(data.username, data.password);
      router.push('/'); // Redirect to dashboard or home
    } catch (e: any) {
      setErrorMessage(e.message || '로그인 실패: 알 수 없는 오류');
      setError('username', { type: 'manual', message: '' }); // Clear field errors if general error
      setError('password', { type: 'manual', message: '' });
    } finally {
      setLoading(false);
    }
  }, [auth, router, setError]);

  return (
    <Box component="form" onSubmit={handleSubmit(handleLogin)} noValidate sx={{ mt: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>아이디</Typography>
          <Controller
            name="username"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                variant="outlined"
                error={!!errors.username}
                helperText={errors.username?.message}
                autoComplete="username" // For browser autocomplete
              />
            )}
          />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>비밀번호</Typography>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                variant="outlined"
                type={showPassword ? 'text' : 'password'}
                error={!!errors.password}
                helperText={errors.password?.message}
                autoComplete="current-password" // For browser autocomplete
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} sx={{ pt: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="text"
            color="primary"
            onClick={() => setIsPasswordResetDialogOpen(true)}
            disabled={loading}
          >
            비밀번호 재설정
          </Button>
        </Grid>
        <Grid item xs={12} sx={{ pt: 0 }}>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            로그인
          </Button>
        </Grid>
        {errorMessage && (
          <Grid item xs={12} sx={{ pt: 2 }}>
            <Alert severity="error" variant="filled">
              {errorMessage}
            </Alert>
          </Grid>
        )}
      </Grid>

      <PasswordResetDialog
        open={isPasswordResetDialogOpen}
        onClose={() => setIsPasswordResetDialogOpen(false)}
      />
    </Box>
  );
};
