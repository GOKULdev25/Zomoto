import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  icon?: string;
  searchable?: boolean;
  maxDisplay?: number;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  values,
  onChange,
  options,
  placeholder = 'Select options',
  icon,
  searchable = false,
  maxDisplay = 2,
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
    setSearch('');
  };

  const handleSelect = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter(v => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    if (values.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(o => o.value));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Build display label
  const getDisplayLabel = () => {
    if (values.length === 0) return placeholder;
    if (values.length === options.length) return 'All selected';
    const selectedLabels = values
      .map(v => options.find(o => o.value === v)?.label ?? v)
      .slice(0, maxDisplay);
    const remaining = values.length - maxDisplay;
    const label = selectedLabels.join(', ');
    return remaining > 0 ? `${label} +${remaining}` : label;
  };

  const filteredOptions = searchable
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const isAllSelected = values.length === options.length;

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
          icon ? 'pl-11' : 'pl-sm'
        } pr-10 text-left text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all shadow-inner backdrop-blur-md cursor-pointer ${
          isOpen ? 'border-primary ring-1 ring-primary/30' : 'border-white/10'
        }`}
      >
        <span className={`block truncate font-body-md ${values.length === 0 ? 'text-on-surface-variant/50' : ''}`}>
          {getDisplayLabel()}
        </span>
        <div className="absolute inset-y-0 right-0 pr-sm flex items-center gap-1">
          {values.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Clear selection"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-sm">close</span>
            </button>
          )}
          <span className={`material-symbols-outlined text-on-surface-variant text-lg transition-transform duration-300 pointer-events-none ${isOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Selection count badge */}
      {values.length > 0 && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-20">
          <span className="text-[10px] font-bold text-on-primary">{values.length}</span>
        </div>
      )}

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

            {/* Select All option */}
            {!search && (
              <button
                onClick={handleSelectAll}
                className="w-full text-left px-4 py-2 text-xs transition-colors flex items-center justify-between border-b border-white/5 hover:bg-white/5 text-on-surface-variant"
              >
                <span className="font-medium">{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isAllSelected
                    ? 'bg-primary border-primary'
                    : values.length > 0
                    ? 'border-primary bg-primary/30'
                    : 'border-white/20'
                }`}>
                  {isAllSelected && (
                    <span className="material-symbols-outlined text-[12px] text-on-primary">check</span>
                  )}
                  {!isAllSelected && values.length > 0 && (
                    <span className="material-symbols-outlined text-[12px] text-primary">remove</span>
                  )}
                </div>
              </button>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-on-surface-variant text-center">
                  No matches found.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = values.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'text-on-surface hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-white/20'
                      }`}>
                        {isSelected && (
                          <span className="material-symbols-outlined text-[12px] text-on-primary">check</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom bar with count */}
            {values.length > 0 && (
              <div className="px-4 py-2 border-t border-white/5 bg-surface/50 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">
                  {values.length} selected
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-primary font-medium hover:underline cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
