// src/views/auth/Login.tsx
import React from 'react';
import { Container, Grid, Box, Paper, Typography } from '@mui/material';

import { Logo } from '@/react-components/layout/Logo'; // Assuming this path
import { LoginForm } from '@/react-components/auth/LoginForm'; // Assuming this path

export const Login: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: (theme) => theme.palette.grey[100], // Mimic a light background
      }}
    >
      <Container maxWidth="sm">
        <Grid container spacing={0} justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
          <Grid item xs={12} lg={8} md={6}> {/* Adjusted grid sizes to match original Vue logic roughly */}
            <Paper elevation={10} sx={{ p: { xs: 2, sm: 4 }, borderRadius: '10px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <Logo />
              </Box>
              <Typography variant="body1" color="textSecondary" align="center" sx={{ mb: 3 }}>
                Studio One Platform
              </Typography>
              <LoginForm />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
