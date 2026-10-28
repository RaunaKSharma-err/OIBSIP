import { apiClient } from '@/lib/api-client';
import { config } from '@/lib/config';
import { useAuthStore } from '@/lib/auth-store';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  User,
} from '@/types';

const MOCK_DELAY = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockLogin(data: LoginRequest): Promise<LoginResponse> {
  await delay(MOCK_DELAY);
  const isAdmin = data.email.startsWith('admin');
  const user: User = {
    id: isAdmin ? 'admin-001' : 'user-001',
    name: isAdmin ? 'Admin User' : 'John Customer',
    email: data.email,
    role: isAdmin ? 'admin' : 'customer',
    isEmailVerified: true,
    createdAt: new Date().toISOString(),
  };
  return { user, accessToken: `mock-token-${user.id}` };
}

async function mockRegister(data: RegisterRequest): Promise<RegisterResponse> {
  await delay(MOCK_DELAY);
  const user: User = {
    id: 'user-new',
    name: data.name,
    email: data.email,
    role: 'customer',
    isEmailVerified: false,
    createdAt: new Date().toISOString(),
  };
  return {
    user,
    token: `mock-token-${user.id}`,
    message: 'Registration successful. Please verify your email.',
  };
}

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    if (config.useMock) return mockLogin(data);
    const res = await apiClient.post<{ success: boolean; data: LoginResponse }>('/auth/login', data, {
      credentials: 'include',
    });
    return res.data;
  },

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    if (config.useMock) return mockRegister(data);
    const res = await apiClient.post<{ success: boolean; data: RegisterResponse }>('/auth/register', data);
    return res.data;
  },

  async resendVerification(data: { email: string }): Promise<{ message: string }> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return { message: 'Verification email resent.' };
    }
    return apiClient.post<{ message: string }>('/auth/resend-verification', data);
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<{ message: string }> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return { message: 'Email verified successfully.' };
    }
    const res = await apiClient.post<{ success: boolean; data: { message: string } }>('/auth/verify-email', data);
    return res.data;
  },

  async forgotPassword(
    data: ForgotPasswordRequest
  ): Promise<{ message: string }> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return {
        message:
          'If an account exists for that email, a reset link has been sent.',
      };
    }
    return apiClient.post<{ message: string }>('/auth/forgot-password', data);
  },

  async resetPassword(
    data: ResetPasswordRequest
  ): Promise<{ message: string }> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return { message: 'Password reset successfully.' };
    }
    return apiClient.post<{ message: string }>('/auth/reset-password', data);
  },

  async getProfile(): Promise<User> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return useAuthStore.getState().user as User;
    }
    const res = await apiClient.get<{ success: boolean; data: { user: User } }>('/auth/me');
    return res.data.user;
  },

  async logout(): Promise<void> {
    if (config.useMock) {
      await delay(200);
      return;
    }
    await apiClient.post('/auth/logout');
  },
};
