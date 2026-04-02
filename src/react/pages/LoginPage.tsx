import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import axios from "axios";
import { API_BASE_URL } from "@/config/backend";
import { resolveAxiosError } from "@/utils/helpers";
import { useAuthStore } from "@/react/auth/store";

const loginSchema = yup.object({
  username: yup.string().required("아이디를 입력하세요"),
  password: yup
    .string()
    .min(6, "비밀번호는 최소 6자 이상입니다")
    .required("비밀번호를 입력하세요"),
});

const resetSchema = yup.object({
  email: yup
    .string()
    .required("이메일을 입력해주세요.")
    .email("올바른 이메일 형식이 아닙니다."),
});

type LoginFormValues = yup.InferType<typeof loginSchema>;
type ResetFormValues = yup.InferType<typeof resetSchema>;

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const login = useAuthStore((state) => state.login);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const returnUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("returnUrl") || "/";
  }, [location.search]);

  const loginForm = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const resetForm = useForm({
    resolver: yupResolver(resetSchema),
    defaultValues: {
      email: "",
    },
  });

  if (token) {
    return <Navigate to={returnUrl} replace />;
  }

  const submitLogin = loginForm.handleSubmit(async (values: LoginFormValues) => {
    setSubmitting(true);
    setLoginError("");
    try {
      await login(values.username, values.password);
      navigate(returnUrl, { replace: true });
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "로그인에 실패했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  });

  const submitReset = resetForm.handleSubmit(async (values: ResetFormValues) => {
    setResetSubmitting(true);
    setResetError("");
    setResetMessage("");
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/password-reset/request`,
        { email: values.email },
        { withCredentials: true }
      );
      setResetMessage("비밀번호 재설정 메일이 발송되었습니다.");
      resetForm.reset();
    } catch (error) {
      setResetError(resolveAxiosError(error));
    } finally {
      setResetSubmitting(false);
    }
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={10} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3 }}>
          <Typography variant="h4" textAlign="center" gutterBottom>
            Studio One Platform
          </Typography>
          <Typography
            variant="body2"
            textAlign="center"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            React bootstrap gate 기준 로그인 화면
          </Typography>

          <Box component="form" onSubmit={submitLogin} noValidate>
            <Stack spacing={2}>
              <Controller
                name="username"
                control={loginForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="아이디"
                    error={!!loginForm.formState.errors.username}
                    helperText={loginForm.formState.errors.username?.message}
                  />
                )}
              />
              <Controller
                name="password"
                control={loginForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="비밀번호"
                    type={showPassword ? "text" : "password"}
                    error={!!loginForm.formState.errors.password}
                    helperText={loginForm.formState.errors.password?.message}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword((value) => !value)}>
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
              <Box sx={{ textAlign: "right" }}>
                <Button
                  variant="text"
                  onClick={() => setResetOpen(true)}
                  disabled={submitting}
                >
                  비밀번호 재설정
                </Button>
              </Box>
              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "로그인"
                )}
              </Button>
              {loginError ? <Alert severity="error">{loginError}</Alert> : null}
            </Stack>
          </Box>
        </Paper>
      </Container>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>비밀번호 재설정</DialogTitle>
        <DialogContent>
          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            입력하신 이메일로 비밀번호 재설정 링크를 전송합니다.
          </Alert>
          <Box component="form" id="password-reset-form" onSubmit={submitReset}>
            <Controller
              name="email"
              control={resetForm.control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  margin="normal"
                  label="이메일"
                  type="email"
                  error={!!resetForm.formState.errors.email}
                  helperText={resetForm.formState.errors.email?.message}
                />
              )}
            />
          </Box>
          {resetMessage ? <Alert severity="success">{resetMessage}</Alert> : null}
          {resetError ? <Alert severity="error">{resetError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetSubmitting}>
            닫기
          </Button>
          <Button
            type="submit"
            form="password-reset-form"
            variant="contained"
            disabled={resetSubmitting}
          >
            {resetSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "재설정 메일 보내기"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
