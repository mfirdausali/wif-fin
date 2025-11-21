export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user?: {
    name: string;
    role: string;
  };
}

export enum InputType {
  TEXT = 'text',
  PASSWORD = 'password',
  EMAIL = 'email'
}

export type DashboardView = 'overview' | 'create-invoice';
