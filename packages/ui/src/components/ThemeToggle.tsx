import { Moon, Sun } from 'lucide-react';
import React from 'react';
import { Button } from './Button.js';

export interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="rounded-full"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-[var(--color-butter)] transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-[var(--color-kernel)] transition-transform hover:-rotate-12" />
      )}
    </Button>
  );
};
