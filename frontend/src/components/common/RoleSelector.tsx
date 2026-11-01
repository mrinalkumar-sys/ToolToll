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
  onSelectTab?: (tab: any) => void;
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
          sublabel: 'API Developer',
          icon: Hammer,
          dotColor: '#FF5500', // Brand Orange
        };
      case 'admin':
        return {
          id: 'admin' as UserRole,
          label: 'Role: Admin',
          sublabel: 'Platform Administrator',
          icon: Shield,
          dotColor: '#38BDF8', // Sky blue
        };
      case 'consumer':
      default:
        return {
          id: 'consumer' as UserRole,
          label: 'Role: Consumer',
          sublabel: 'Agent Owner',
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

  const Icon = currentRoleObj.icon;

  return (
    <div
      ref={containerRef}
      className="role-selector-container"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Role Indicator Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary btn-sm role-selector-trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-xs)',
          fontSize: '0.80rem',
          fontWeight: 700,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border-dark)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Icon size={14} color={currentRoleObj.dotColor} />
        <span
          style={{
            width: '6px',
            height: '6px',
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

      {/* Popover Dropdown Menu (Sign Out only) */}
      {isOpen && (
        <div
          role="menu"
          aria-label="User session menu"
          className="role-selector-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '150px',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            zIndex: 1050,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {onLogout && (
            <button
              type="button"
              role="menuitem"
              disabled={isLoggingOut}
              className="role-option-btn role-logout-btn"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid transparent',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#F87171',
                cursor: isLoggingOut ? 'wait' : 'pointer',
                textAlign: 'left',
                width: '100%',
                outline: 'none',
                opacity: isLoggingOut ? 0.6 : 1,
                fontSize: '0.80rem',
                fontWeight: 600,
              }}
            >
              <LogOut size={14} color="#EF4444" strokeWidth={2.2} />
              <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          )}
        </div>
      )}
      </div>
  );
};
