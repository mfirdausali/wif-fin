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

// Background Pattern Component (Japanese Seigaiha wave pattern)
const BackgroundPattern = () => (
  <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.05]" aria-hidden="true">
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="seigaiha" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M20 0 A20 20 0 0 0 0 20 A20 20 0 0 0 20 40 A20 20 0 0 0 40 20 A20 20 0 0 0 20 0 Z M20 5 A15 15 0 0 0 5 20 A15 15 0 0 0 20 35 A15 15 0 0 0 35 20 A15 15 0 0 0 20 5 Z M20 10 A10 10 0 0 0 10 20 A10 10 0 0 0 20 30 A10 10 0 0 0 30 20 A10 10 0 0 0 20 10 Z" fill="none" stroke="#ffffff" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#seigaiha)" />
    </svg>
  </div>
);

// Input Field Component matching portal design
interface InputFieldProps {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  isPasswordVisible?: boolean;
  togglePasswordVisibility?: () => void;
  autoComplete?: string;
  autoFocus?: boolean;
}

const InputField = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  isPasswordVisible,
  togglePasswordVisibility,
  autoComplete,
  autoFocus,
}: InputFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const currentType = type === 'password' && isPasswordVisible ? 'text' : type;

  return (
    <div className="mb-5 group">
      <label htmlFor={id} className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={currentType}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            block w-full px-3 py-3 text-gray-900 bg-white border border-gray-300
            placeholder-gray-400 focus:outline-none transition-colors duration-150
            ${isFocused ? 'border-wif-navy ring-1 ring-wif-navy' : 'hover:border-gray-400'}
          `}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
        />
        {type === 'password' && togglePasswordVisibility && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-wif-navy cursor-pointer focus:outline-none text-xs uppercase font-bold tracking-wider"
          >
            {isPasswordVisible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
};

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

  // First-time setup screen (keep original card-based design)
  if (isFirstTime) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md">
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
        </div>
      </div>
    );
  }

  // Main Login Screen - Portal Design
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-sans bg-white">

      {/* Left Panel: The "Brand" Column */}
      <div className="relative w-full md:w-[450px] lg:w-[500px] xl:w-[600px] flex-shrink-0 bg-wif-navy text-white flex flex-col justify-between overflow-hidden order-2 md:order-1 min-h-[300px] md:min-h-screen">
        {/* Pattern Layer */}
        <BackgroundPattern />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-wif-navy/90 pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 p-10 lg:p-14">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-white text-wif-navy flex items-center justify-center font-serif font-bold text-2xl shadow-md">
              W
            </div>
            <span className="text-xl font-semibold tracking-tight">WIF JAPAN</span>
          </div>
          <div className="h-1 w-12 bg-wif-blue mt-4 mb-2"></div>
          <p className="text-sm text-gray-300 uppercase tracking-widest font-medium">Finance Department</p>
        </div>

        {/* Quote Content */}
        <div className="relative z-10 px-10 lg:px-14 pb-20">
          <blockquote className="font-serif text-2xl lg:text-3xl leading-snug text-white mb-6 font-light">
            "Accuracy and integrity in every transaction."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="h-px w-6 bg-gray-400"></div>
            <span className="text-sm text-gray-400 uppercase tracking-wide">Financial Excellence</span>
          </div>
        </div>

        {/* Vertical Japanese Text Decoration */}
        <div className="absolute top-1/2 -translate-y-1/2 right-8 opacity-10 pointer-events-none select-none hidden md:block">
          <span className="writing-vertical-rl text-7xl font-serif font-bold text-white" style={{ writingMode: 'vertical-rl' }}>
            信頼・時間・努力
          </span>
        </div>
      </div>

      {/* Right Panel: The "Action" Column */}
      <main className="flex-1 bg-white flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 relative order-1 md:order-2">

        <div className="w-full max-w-md animate-slide-up">

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">Log in</h2>
            <p className="text-gray-600 text-sm">
              Access the WIF Japan Financial System
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Form Section */}
          <form onSubmit={handleLogin}>
            <InputField
              id="username"
              label="Username or Email"
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
            />

            <InputField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              isPasswordVisible={showPassword}
              togglePasswordVisibility={() => setShowPassword(!showPassword)}
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between mt-2 mb-8">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 text-wif-blue focus:ring-wif-blue border-gray-300 rounded-sm cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none">
                  Remember me
                </label>
              </div>
              <a href="#" className="text-sm text-wif-blue hover:underline font-medium">Forgot password?</a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-sm text-base font-bold text-white bg-wif-navy
                hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wif-navy
                transition-all duration-200 ease-in-out shadow-sm
                ${isLoading ? 'opacity-80 cursor-wait' : ''}
              `}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col md:flex-row justify-center md:justify-start space-y-1 md:space-y-0 md:space-x-1 text-sm leading-relaxed">
              <span className="text-gray-600">Need help?</span>
            </div>
            <div className="mt-1">
              <span className="text-wif-blue font-bold text-sm">Contact administrator</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              <span>© 2025 WIF Japan. All rights reserved.</span>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
