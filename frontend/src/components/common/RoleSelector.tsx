import React, { useState, useRef, useEffect } from 'react';
import { UserRole } from '../../types';
import { ChevronDown, Check, Bot, Hammer, Shield, LogOut } from 'lucide-react';

interface RoleSelectorProps {
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  isAdmin: boolean;
  isCreator?: boolean;
  isConsumer?: boolean;
  disabled?: boolean;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  activeRole,
  onSelectRole,
  isAdmin,
  isCreator,
  isConsumer,
  disabled = false,
  onLogout,
  isLoggingOut = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const roles: Array<{
    id: UserRole;
    label: string;
    sublabel: string;
    icon: React.FC<{ size?: number; color?: string }>;
    dotColor: string;
  }> = [];

  // Strictly filter roles according to verified user authorizations
  if (isConsumer ?? true) {
    roles.push({
      id: 'consumer',
      label: 'Role: Consumer',
      sublabel: 'Agent owner & tool consumer',
      icon: Bot,
      dotColor: '#10B981', // Emerald
    });
  }

  if (isCreator) {
    roles.push({
      id: 'creator',
      label: 'Role: Creator',
      sublabel: 'API publisher & earnings studio',
      icon: Hammer,
      dotColor: '#FF5500', // Brand Orange
    });
  }

  if (isAdmin) {
    roles.push({
      id: 'admin',
      label: 'Role: Admin',
      sublabel: 'Governance, moderation & solvency',
      icon: Shield,
      dotColor: '#38BDF8', // Sky blue
    });
  }

  // Fallback safe entry
  if (roles.length === 0) {
    roles.push({
      id: activeRole || 'consumer',
      label: `Role: ${activeRole.toUpperCase()}`,
      sublabel: 'Authenticated session',
      icon: Bot,
      dotColor: '#10B981',
    });
  }

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
        const currentIndex = roles.findIndex((r) => r.id === activeRole);
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    const totalItems = onLogout ? roles.length + 1 : roles.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < roles.length) {
          onSelectRole(roles[focusedIndex].id);
          setIsOpen(false);
          triggerRef.current?.focus();
        } else if (focusedIndex === roles.length && onLogout && !isLoggingOut) {
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

  const currentRoleObj = roles.find((r) => r.id === activeRole) || roles[0];

  return (
    <div
      ref={containerRef}
      className="role-selector-container"
      style={{ position: 'relative', display: 'inline-block' }}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        className="role-selector-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select active role. Current role is ${currentRoleObj.label}`}
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

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available user roles"
          className="role-selector-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '220px',
            background: '#111827', // Dark navy background
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
          <div
            style={{
              padding: '6px 10px 4px',
              fontSize: '0.64rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#9CA3AF',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: '3px',
            }}
          >
            {roles.length > 1 ? 'Switch Active Role' : 'Authorized Role'}
          </div>

          {roles.map((role, idx) => {
            const isSelected = role.id === activeRole;
            const isFocused = idx === focusedIndex;
            const Icon = role.icon;

            return (
              <button
                key={role.id}
                role="option"
                aria-selected={isSelected}
                type="button"
                className={`role-option-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onSelectRole(role.id);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-xs)',
                  border: isSelected ? '1px solid rgba(255, 85, 0, 0.35)' : '1px solid transparent',
                  background: isSelected
                    ? 'rgba(255, 85, 0, 0.12)'
                    : isFocused
                    ? '#1F2937' // Hover / keyboard focus dark navy
                    : 'transparent',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  outline: isFocused && !isSelected ? '1px solid #374151' : 'none',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    background: isSelected ? 'rgba(255, 85, 0, 0.2)' : '#1F2937',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={13} color={isSelected ? 'var(--brand-orange)' : '#D1D5DB'} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 700 : 600,
                      color: isSelected ? '#FFFFFF' : '#E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{role.label.replace('Role: ', '')}</span>
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: role.dotColor,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: isSelected ? '#FCA5A5' : '#9CA3AF',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {role.sublabel}
                  </div>
                </div>

                {isSelected && (
                  <Check size={14} color="var(--brand-orange)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                )}
              </button>
            );
          })}

          {/* Subtle Divider & Functional Logout Option */}
          {onLogout && (
            <>
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  margin: '4px 0',
                }}
              />

              <button
                type="button"
                role="option"
                aria-selected={false}
                disabled={isLoggingOut}
                className={`role-option-btn role-logout-btn ${focusedIndex === roles.length ? 'focused' : ''}`}
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                onMouseEnter={() => setFocusedIndex(roles.length)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-xs)',
                  border: focusedIndex === roles.length ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent',
                  background: focusedIndex === roles.length
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
            </>
          )}
        </div>
      )}
    </div>
  );
};
