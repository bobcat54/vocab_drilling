// Base Input component

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          'flex w-full rounded-lg border border-gray-300 bg-white px-4 py-3',
          // Mobile optimization - prevent iOS zoom
          'text-[18px]',
          // Focus styles
          'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
          // Dark mode
          'dark:border-gray-600 dark:bg-gray-700 dark:text-white',
          // Placeholder
          'placeholder:text-gray-400 dark:placeholder:text-gray-500',
          // Disabled
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Minimum tap target
          'min-h-[44px]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
