import React, { useState } from 'react';
import { InputType } from '../types';
import InputField from './InputField';

interface LoginCardProps {
  onLogin: () => void;
}

const LoginCard: React.FC<LoginCardProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 800);
  };

  return (
    <div className="w-full animate-slide-up">
      
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">Log in</h2>
        <p className="text-gray-600 text-sm">
           Access the WIF Japan Financial System
        </p>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="">
        <InputField
          id="username"
          label="Username or Email"
          type={InputType.TEXT}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
        />

        <InputField
          id="password"
          label="Password"
          type={InputType.PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          isPasswordVisible={isPasswordVisible}
          togglePasswordVisibility={() => setIsPasswordVisible(!isPasswordVisible)}
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
          <div className="flex justify-center md:justify-start space-x-1 text-sm">
              <span className="text-gray-600">Not enrolled?</span>
              <a href="#" className="text-wif-blue font-bold hover:underline">Register now</a>
          </div>
      </div>
    </div>
  );
};

export default LoginCard;
