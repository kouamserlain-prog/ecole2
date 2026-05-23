import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiFilter, FiChevronDown } from 'react-icons/fi';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  options: FilterOption[];
  /** Valeur sélectionnée (nom explicite) */
  selected?: string;
  /** Alias de `selected` (compatibilité avec les anciens appels) */
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  /** Bouton déclencheur plus bas (ex. barre outils Élèves) */
  compact?: boolean;
  /** Pleine largeur, sans icône filtre — pour les formulaires (modales, etc.) */
  variant?: 'filter' | 'field';
}

/** Au-dessus des modales (z-[9999]) et des toasts */
const Z_BACKDROP = 100_000;
const Z_PANEL = 100_001;

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  options,
  selected,
  value,
  onChange,
  label = 'Filtrer',
  className = '',
  compact = false,
  variant = 'filter',
}) => {
  const isField = variant === 'field';
  const triggerCompact = compact && !isField;
  const current = selected ?? value ?? '';
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 192 });

  const selectedOption = options.find((opt) => opt.value === current);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const panelMin = triggerCompact ? 176 : isField ? 200 : 208;
    const width = Math.max(rect.width, panelMin);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;
    let left = rect.left;
    if (left + width > vw - margin) {
      left = Math.max(margin, vw - width - margin);
    }
    const maxPanelH = Math.min(vh * 0.7, 320);
    let top = rect.bottom + 8;
    if (top + maxPanelH > vh - margin) {
      const aboveTop = rect.top - 8 - maxPanelH;
      if (aboveTop >= margin) {
        top = aboveTop;
      }
    }
    setPanelPos({ top, left, width });
  }, [triggerCompact, isField]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const panel =
    isOpen && typeof document !== 'undefined' ? (
      <>
        <div
          className="fixed inset-0"
          style={{ zIndex: Z_BACKDROP }}
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
        <div
          role="listbox"
          aria-label={label}
          className={`fixed max-h-[min(70vh,20rem)] overflow-y-auto rounded-xl border border-indigo-200/90 bg-gradient-to-b from-indigo-50/98 via-violet-50/95 to-white py-1 shadow-lg shadow-indigo-200/30 ring-2 ring-violet-300/25 backdrop-blur-xl ${
            compact ? 'text-left' : ''
          }`}
          style={{
            zIndex: Z_PANEL,
            top: panelPos.top,
            left: panelPos.left,
            minWidth: panelPos.width,
            maxWidth: 'min(100vw - 2rem, 20rem)',
          }}
        >
          {options.map((option, index) => (
            <button
              type="button"
              key={`${option.value}-${option.label}-${index}`}
              role="option"
              aria-selected={current === option.value ? 'true' : 'false'}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left transition-colors ${
                compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
              } ${
                current === option.value
                  ? 'bg-gradient-to-r from-violet-200/95 to-indigo-200/90 text-indigo-950 font-semibold'
                  : 'text-indigo-950/85 hover:bg-indigo-100/80 hover:text-indigo-950'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </>
    ) : null;

  return (
    <div className={`relative ${isField ? 'w-full' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="listbox"
        className={`flex items-center rounded-xl transition-all shadow-sm ${
          isField ? 'w-full justify-between gap-2 px-3 py-2.5 border text-left' : ''
        } ${
          triggerCompact
            ? 'space-x-1.5 px-2.5 py-2 border text-left'
            : isField
              ? ''
              : 'space-x-2 px-4 py-3 border-2'
        } ${
          isOpen
            ? 'border-indigo-300/90 bg-gradient-to-r from-indigo-50/95 via-violet-50/90 to-indigo-50/95 ring-2 ring-violet-300/40'
            : 'border-stone-300/90 bg-white/90 hover:border-indigo-300/60 hover:bg-indigo-50/30'
        }`}
      >
        {!isField ? (
          <FiFilter
            className={`shrink-0 ${triggerCompact ? 'h-4 w-4' : 'h-5 w-5'} ${
              isOpen ? 'text-indigo-500' : 'text-indigo-400/80'
            }`}
          />
        ) : null}
        {!isField ? (
          <span
            className={`font-medium shrink-0 ${triggerCompact ? 'text-xs' : 'text-sm'} ${
              isOpen ? 'text-indigo-900' : 'text-stone-800'
            }`}
          >
            {label}
          </span>
        ) : null}
        <span
          className={`truncate min-w-0 flex-1 ${triggerCompact || isField ? 'text-sm' : 'text-sm'} ${
            isOpen ? 'text-violet-800' : isField ? 'text-stone-800' : 'text-stone-600'
          }`}
        >
          {selectedOption?.label || (current ? current : isField ? 'Choisir…' : 'Choisir…')}
        </span>
        <FiChevronDown
          className={`transition-transform shrink-0 ${triggerCompact || isField ? 'h-4 w-4' : 'h-4 w-4'} ${
            isOpen ? 'rotate-180 text-indigo-600' : 'text-indigo-400/70'
          }`}
        />
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
};

export default FilterDropdown;
