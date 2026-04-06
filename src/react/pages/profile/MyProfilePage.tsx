import { useState, useEffect } from "react";
import {
  Box, Stack, Typography, Button, TextField, Divider,
  CircularProgress, Alert, Card, CardContent, CardHeader, FormControlLabel, Switch,
} from "@mui/material";
import { SaveOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactProfileApi } from "./api";
import type { MeProfileDto } from "@/types/studio/user";

const AUTO_REFRESH_KEY = "studio.jwt.autoRefresh";

export function MyProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<MeProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem(AUTO_REFRESH_KEY) === "true");

  useEffect(() => {
    reactProfileApi.getProfile()
      .then(p => { setProfile(p); setForm({ name: p.name, email: p.email ?? "" }); setError(null); })
      .catch(() => setError("프로필을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await reactProfileApi.updateProfile({ name: form.name, email: form.email || null });
      toast.success("프로필이 저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function handleAutoRefreshChange(v: boolean) {
    setAutoRefresh(v);
    localStorage.setItem(AUTO_REFRESH_KEY, String(v));
  }

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Stack spacing={3}>
      <Typography variant="h5">내 프로필</Typography>
      <Card variant="outlined">
        <CardHeader title="기본 정보" />
        <CardContent>
          <Stack spacing={2} sx={{ maxWidth: 500 }}>
            <TextField label="아이디" value={profile?.username ?? ""} InputProps={{ readOnly: true }} size="small" />
            <TextField label="이름" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" />
            <TextField label="이메일" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} size="small" />
            <Box>
              <Button variant="contained" startIcon={<SaveOutlined />} onClick={handleSave} disabled={saving}>
                {saving ? <CircularProgress size={20} /> : "저장"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardHeader title="인증 설정" />
        <CardContent>
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={e => handleAutoRefreshChange(e.target.checked)} />}
            label="JWT 자동 갱신"
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            세션 만료 전 자동으로 토큰을 갱신합니다. (브라우저 로컬 설정)
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
