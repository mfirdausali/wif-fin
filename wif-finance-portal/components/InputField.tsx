import React, { useState } from 'react';
import { InputType } from '../types';

interface InputFieldProps {
  id: string;
  label: string;
  type: InputType;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  togglePasswordVisibility?: () => void;
  isPasswordVisible?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  togglePasswordVisibility,
  isPasswordVisible
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const currentType = type === InputType.PASSWORD && isPasswordVisible ? InputType.TEXT : type;

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
          required
        />
        {type === InputType.PASSWORD && (
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

export default InputField;