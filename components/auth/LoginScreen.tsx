/**
 * Login Screen Component
 *
 * Handles user authentication with:
 * - Username/email and password login
 * - Remember me functionality
 * - First-time setup flow
 * - Error handling and validation
 * - Loading states
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Lock, User, Mail, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { LoginCredentials } from '../../types/auth';
import { validatePasswordStrength } from '../../services/authService';

interface LoginScreenProps {
  onLogin: (credentials: LoginCredentials) => void;
  onSetupAdmin: (username: string, email: string, fullName: string, password: string) => void;
  isFirstTime: boolean;
  error: string | null;
  isLoading: boolean;
}

export function LoginScreen({
  onLogin,
  onSetupAdmin,
  isFirstTime,
  error,
  isLoading,
}: LoginScreenProps) {
  // Login form state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // First-time setup form state
  const [setupUsername, setSetupUsername] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupFullName, setSetupFullName] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(
    null
  );

  // Validate setup password strength
  useEffect(() => {
    if (setupPassword.length > 0) {
      const validation = validatePasswordStrength(setupPassword);
      setPasswordStrength(validation.strength);
    } else {
      setPasswordStrength(null);
    }
  }, [setupPassword]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!usernameOrEmail.trim() || !password) {
      return;
    }

    onLogin({
      usernameOrEmail: usernameOrEmail.trim(),
      password,
      rememberMe,
    });
  };

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    // Validate username
    if (!setupUsername.trim() || setupUsername.length < 3) {
      setSetupError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(setupUsername)) {
      setSetupError('Username can only contain letters, numbers, and underscores');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!setupEmail.trim() || !emailRegex.test(setupEmail)) {
      setSetupError('Please enter a valid email address');
      return;
    }

    // Validate full name
    if (!setupFullName.trim() || setupFullName.length < 2) {
      setSetupError('Full name must be at least 2 characters');
      return;
    }

    // Validate password
    const validation = validatePasswordStrength(setupPassword);
    if (!validation.isValid) {
      setSetupError(validation.errors.join('. '));
      return;
    }

    // Validate password confirmation
    if (setupPassword !== setupConfirmPassword) {
      setSetupError('Passwords do not match');
      return;
    }

    onSetupAdmin(setupUsername.trim(), setupEmail.trim(), setupFullName.trim(), setupPassword);
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'strong':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'weak':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 'strong':
        return 'Strong password';
      case 'medium':
        return 'Medium strength';
      case 'weak':
        return 'Weak password';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {isFirstTime ? (
          // First-time setup screen
          <Card className="shadow-xl">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-2">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Welcome to WIF Finance</CardTitle>
              <CardDescription>
                Let's set up your administrator account to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetup} className="space-y-4">
                {setupError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{setupError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="setup-username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="setup-username"
                      type="text"
                      placeholder="admin"
                      value={setupUsername}
                      onChange={(e) => setSetupUsername(e.target.value)}
                      className="pl-10"
                      autoComplete="username"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Letters, numbers, and underscores only. Min 3 characters.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="admin@wifjapan.com"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      className="pl-10"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-fullname">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="setup-fullname"
                    type="text"
                    placeholder="John Doe"
                    value={setupFullName}
                    onChange={(e) => setSetupFullName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="setup-password">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="setup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="pl-10 pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordStrength && (
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getPasswordStrengthColor()}`}
                          style={{
                            width:
                              passwordStrength === 'strong'
                                ? '100%'
                                : passwordStrength === 'medium'
                                ? '66%'
                                : '33%',
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-600">{getPasswordStrengthText()}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Min 8 characters, with uppercase, lowercase, number, and special character
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-confirm-password">
                    Confirm Password <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="setup-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Administrator Account'}
                </Button>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                  <p className="text-blue-900 font-medium mb-1">Important:</p>
                  <p className="text-blue-700">
                    This will be your system administrator account with full access. Keep your
                    credentials secure.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          // Login screen
          <Card className="shadow-xl">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">WIF Finance System</CardTitle>
              <CardDescription>Sign in to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username">Username or Email</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username or email"
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      className="pl-10"
                      autoComplete="username"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <Label
                    htmlFor="remember-me"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Remember me for 30 days
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>

                <div className="text-center text-sm text-gray-500 mt-4">
                  <p>Need help? Contact your system administrator</p>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>WIF JAPAN Finance Department</p>
          <p className="mt-1 text-xs text-gray-500">
            Secure Authentication • Role-Based Access Control
          </p>
        </div>
      </div>
    </div>
  );
}
