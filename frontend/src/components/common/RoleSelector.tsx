import React, { useState, useRef, useEffect } from 'react';
import { UserRole } from '../../types';
import { ChevronDown, Bot, Hammer, Shield, LogOut } from 'lucide-react';

interface RoleSelectorProps {
  actualRole?: UserRole;
  activeRole?: UserRole;
  isAdmin?: boolean;
  isCreator?: boolean;
  isConsumer?: boolean;
  disabled?: boolean;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  onSelectRole?: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  actualRole,
  activeRole,
  isAdmin,
  isCreator,
  disabled = false,
  onLogout,
  isLoggingOut = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Determine actual role from session
  const roleId: UserRole =
    actualRole ||
    (isAdmin
      ? 'admin'
      : isCreator
      ? 'creator'
      : activeRole || 'consumer');

  const currentRoleObj = (() => {
    switch (roleId) {
      case 'creator':
        return {
          id: 'creator' as UserRole,
          label: 'Role: Creator',
          sublabel: 'API publisher & earnings studio',
          icon: Hammer,
          dotColor: '#FF5500', // Brand Orange
        };
      case 'admin':
        return {
          id: 'admin' as UserRole,
          label: 'Role: Admin',
          sublabel: 'Governance, moderation & solvency',
          icon: Shield,
          dotColor: '#38BDF8', // Sky blue
        };
      case 'consumer':
      default:
        return {
          id: 'consumer' as UserRole,
          label: 'Role: Consumer',
          sublabel: 'Agent owner & tool consumer',
          icon: Bot,
          dotColor: '#10B981', // Emerald
        };
    }
  })();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onLogout && !isLoggingOut) {
          setIsOpen(false);
          onLogout();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className="role-selector-container"
      style={{ position: 'relative', display: 'inline-block' }}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button - displays current actual role indicator */}
      <button
        ref={triggerRef}
        type="button"
        className="role-selector-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Current role: ${currentRoleObj.label}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#111827',
          color: '#F3F4F6',
          border: isOpen ? '1px solid var(--brand-orange)' : '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: 'var(--radius-xs)',
          padding: '5px 12px',
          fontSize: '0.80rem',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.18s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(255, 85, 0, 0.2)' : 'none',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: currentRoleObj.dotColor,
            flexShrink: 0,
            boxShadow: `0 0 6px ${currentRoleObj.dotColor}88`,
          }}
        />
        <span style={{ color: '#F3F4F6', whiteSpace: 'nowrap' }}>
          {currentRoleObj.label}
        </span>
        <ChevronDown
          size={14}
          color="#9CA3AF"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            marginLeft: '2px',
          }}
        />
      </button>

      {/* Popover Dropdown Menu (Contains only Logout option) */}
      {isOpen && onLogout && (
        <div
          role="menu"
          aria-label="User session menu"
          className="role-selector-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '200px',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            zIndex: 1050,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={isLoggingOut}
            className={`role-option-btn role-logout-btn ${focusedIndex === 0 ? 'focused' : ''}`}
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            onMouseEnter={() => setFocusedIndex(0)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: 'var(--radius-xs)',
              border: focusedIndex === 0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent',
              background: focusedIndex === 0
                ? 'rgba(239, 68, 68, 0.14)'
                : 'transparent',
              color: '#F87171',
              cursor: isLoggingOut ? 'wait' : 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s ease, border-color 0.15s ease',
              outline: 'none',
              opacity: isLoggingOut ? 0.6 : 1,
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LogOut size={13} color="#EF4444" strokeWidth={2.2} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#F87171',
                  lineHeight: 1.2,
                }}
              >
                {isLoggingOut ? 'Signing out...' : 'Logout'}
              </div>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'rgba(248, 113, 113, 0.72)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                  marginTop: '2px',
                }}
              >
                End authenticated session
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
