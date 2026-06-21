import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DropdownOption {
  value: string | number;
  label: string;
}

interface CustomDropdownProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: DropdownOption[];
  placeholder?: string;
  icon?: string;
  searchable?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  icon,
  searchable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setSearch(''); // Reset search when opening
  };

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  return (
    <div className="relative group" ref={dropdownRef}>
      {/* Icon */}
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none z-10">
          <span className={`material-symbols-outlined text-lg transition-colors ${isOpen ? 'text-primary' : 'text-on-surface-variant group-focus-within:text-primary'}`}>
            {icon}
          </span>
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full bg-surface/50 border rounded-xl py-sm ${
          icon ? 'pl-xl' : 'pl-sm'
        } pr-10 text-left text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all shadow-inner backdrop-blur-md cursor-pointer ${
          isOpen ? 'border-primary ring-1 ring-primary/30' : 'border-white/10'
        }`}
      >
        <span className="block truncate font-body-md">
          {displayLabel}
        </span>
        <div className="absolute inset-y-0 right-0 pr-sm flex items-center pointer-events-none">
          <span className={`material-symbols-outlined text-on-surface-variant text-lg transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute z-50 w-full mt-2 bg-surface-container-high/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Search Input */}
            {searchable && (
              <div className="p-2 border-b border-white/10 bg-surface/50">
                <div className="relative">
                  <span className="absolute inset-y-0 left-2 flex items-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">search</span>
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-surface-container border border-white/5 rounded-lg py-1.5 pl-8 pr-3 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-on-surface-variant text-center">
                  No matches found.
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                      value === opt.value
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-on-surface hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && (
                      <span className="material-symbols-outlined text-[16px] text-primary ml-2 flex-shrink-0">
                        check
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
