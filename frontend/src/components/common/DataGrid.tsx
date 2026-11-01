import React, { useState, useRef, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridReadyEvent,
  GridApi,
  RowClickedEvent,
  ModuleRegistry,
  AllCommunityModule,
} from 'ag-grid-community';

export type { ColDef, GridReadyEvent, GridApi, RowClickedEvent };

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import {
  Search,
  Download,
  SlidersHorizontal,
  RefreshCw,
  Layers,
  ChevronDown,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';

// Register all community features (sorting, filtering, pagination, CSV export, etc.)
ModuleRegistry.registerModules([AllCommunityModule]);

export interface DataGridProps<TData = any> {
  rowData: TData[];
  columnDefs: ColDef<TData>[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  emptyMessage?: string;
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  quickFilter?: boolean;
  columnVisibilityToggle?: boolean;
  exportCsv?: boolean;
  csvFileName?: string;
  onRowClicked?: (event: RowClickedEvent<TData>) => void;
  rowSelection?: 'single' | 'multiple';
  onSelectionChanged?: (selectedRows: TData[]) => void;
  height?: string | number;
  rowHeight?: number;
  headerHeight?: number;
  actions?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}

export function DataGrid<TData = any>({
  rowData,
  columnDefs,
  title,
  subtitle,
  loading = false,
  emptyMessage = 'No records available in this view.',
  pagination = true,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  quickFilter = true,
  columnVisibilityToggle = true,
  exportCsv = true,
  csvFileName = 'tooltoll-export',
  onRowClicked,
  rowSelection,
  onSelectionChanged,
  height = '500px',
  rowHeight = 58,
  headerHeight = 48,
  actions,
  headerRight,
  className = '',
}: DataGridProps<TData>) {
  const gridRef = useRef<AgGridReact<TData>>(null);
  const [gridApi, setGridApi] = useState<GridApi<TData> | null>(null);
  const [searchText, setSearchText] = useState('');
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  const [columnsState, setColumnsState] = useState<{ colId: string; headerName: string; hide: boolean }[]>([]);

  const onGridReady = useCallback((params: GridReadyEvent<TData>) => {
    setGridApi(params.api);

    // Initialize column visibility state
    const cols = params.api.getAllGridColumns() || [];
    const state = cols.map((col) => {
      const def = col.getColDef();
      return {
        colId: col.getColId(),
        headerName: def.headerName || col.getColId(),
        hide: col.isVisible() === false,
      };
    });
    setColumnsState(state);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchText(val);
    if (gridApi) {
      gridApi.setGridOption('quickFilterText', val);
    }
  };

  const handleClearSearch = () => {
    setSearchText('');
    if (gridApi) {
      gridApi.setGridOption('quickFilterText', '');
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setCurrentPageSize(newSize);
    if (gridApi) {
      gridApi.setGridOption('paginationPageSize', newSize);
    }
  };

  const handleExportCsv = () => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `${csvFileName}-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    }
  };

  const toggleColumn = (colId: string) => {
    if (!gridApi) return;
    const col = gridApi.getColumn(colId);
    if (col) {
      const currentVisible = col.isVisible();
      gridApi.setColumnsVisible([colId], !currentVisible);
      setColumnsState((prev) =>
        prev.map((c) => (c.colId === colId ? { ...c, hide: currentVisible } : c))
      );
    }
  };

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 120,
      suppressMovable: false,
    }),
    []
  );

  return (
    <div
      className={`tooltoll-grid-wrapper card-dark ${className}`}
      style={{
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#10121A',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.36)',
      }}
    >
      {/* Top Header Bar */}
      {(title || subtitle || actions || headerRight) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            paddingBottom: '16px',
          }}
        >
          <div>
            {title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(255, 85, 0, 0.12)',
                    border: '1px solid rgba(255, 85, 0, 0.3)',
                    color: '#FF5500',
                  }}
                >
                  <Layers size={16} />
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  {title}
                </h3>
              </div>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-dark-secondary)',
                  margin: '4px 0 0 0',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {actions}
            {headerRight}
          </div>
        </div>
      )}

      {/* Grid Toolbar: Search, Filters, Column Visibility, CSV Export */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Left: Quick Search Filter */}
        {quickFilter && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              minWidth: '260px',
              maxWidth: '380px',
              flex: 1,
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                color: '#646A7E',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchText}
              onChange={handleSearchChange}
              placeholder="Search table records..."
              style={{
                width: '100%',
                padding: '8px 32px 8px 36px',
                background: '#090A0E',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(255, 85, 0, 0.6)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
            />
            {searchText && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#9FA4B5',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Right Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Page Size Selector */}
          {pagination && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: '#9FA4B5',
              }}
            >
              <span>Rows:</span>
              <select
                value={currentPageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                style={{
                  background: '#090A0E',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  padding: '4px 8px',
                  fontSize: '0.78rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Column Visibility Dropdown */}
          {columnVisibilityToggle && columnsState.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsColMenuOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: isColMenuOpen ? 'rgba(255, 85, 0, 0.15)' : '#090A0E',
                  border: isColMenuOpen ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isColMenuOpen ? '#FF5500' : '#9FA4B5',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <SlidersHorizontal size={13} />
                <span>Columns</span>
                <ChevronDown size={12} />
              </button>

              {isColMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    onClick={() => setIsColMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '110%',
                      zIndex: 999,
                      background: '#12141D',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '8px',
                      minWidth: '200px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#646A7E',
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                      }}
                    >
                      Toggle Columns
                    </div>
                    {columnsState.map((c) => (
                      <button
                        key={c.colId}
                        type="button"
                        onClick={() => toggleColumn(c.colId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          background: !c.hide ? 'rgba(255, 85, 0, 0.08)' : 'transparent',
                          border: 'none',
                          color: !c.hide ? '#FFFFFF' : '#646A7E',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.headerName}</span>
                        {!c.hide && <Check size={13} color="#FF5500" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Export CSV Button */}
          {exportCsv && (
            <button
              type="button"
              onClick={handleExportCsv}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#090A0E',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#9FA4B5',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Export grid data to CSV"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
          )}

          {/* Records Counter */}
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#090A0E',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9FA4B5',
            }}
          >
            {rowData?.length || 0} items
          </span>
        </div>
      </div>

      {/* Main AG Grid Container with Obsidian Quartz Theme */}
      <div
        className="ag-theme-quartz-dark tooltoll-ag-grid"
        style={{
          width: '100%',
          height,
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundColor: '#0c0e15',
        }}
      >
        <AgGridReact<TData>
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={rowHeight}
          headerHeight={headerHeight}
          onGridReady={onGridReady}
          pagination={pagination}
          paginationPageSize={currentPageSize}
          paginationPageSizeSelector={false}
          loading={loading}
          onRowClicked={onRowClicked}
          rowSelection={rowSelection ? { mode: rowSelection === 'single' ? 'singleRow' : 'multiRow' } : undefined}
          onSelectionChanged={() => {
            if (onSelectionChanged && gridApi) {
              onSelectionChanged(gridApi.getSelectedRows());
            }
          }}
          overlayNoRowsTemplate={`
            <div style="padding: 30px; text-align: center; color: #646A7E; font-size: 0.85rem;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 10px auto; opacity: 0.5;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <div>${emptyMessage}</div>
            </div>
          `}
          overlayLoadingTemplate={`
            <div style="padding: 30px; text-align: center; color: #FF5500; font-size: 0.85rem; font-weight: 600;">
              <div style="display: inline-block; width: 24px; height: 24px; border: 2px solid rgba(255,85,0,0.3); border-top-color: #FF5500; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 8px;"></div>
              <div>Loading data into grid...</div>
            </div>
          `}
        />
      </div>
    </div>
  );
}

// ============================================================================
// CONVENIENT TOOLTOLL CELL RENDERERS (Exported for reuse)
// ============================================================================

/**
 * Status Badge Renderer for Tool, Call, Moderation, or Ledger states
 */
export const StatusCellRenderer = (params: any) => {
  const status = String(params.value || '').toUpperCase();

  let bg = 'rgba(255, 255, 255, 0.08)';
  let color = '#9FA4B5';
  let border = 'rgba(255, 255, 255, 0.15)';

  if (status === 'APPROVED' || status === 'SUCCESS' || status === 'CREDIT' || status === 'PASSED' || status === 'ACTIVE') {
    bg = 'rgba(16, 185, 129, 0.12)';
    color = '#10B981';
    border = 'rgba(16, 185, 129, 0.3)';
  } else if (status === 'PENDING_REVIEW' || status === 'TESTING' || status === 'PENDING') {
    bg = 'rgba(245, 158, 11, 0.12)';
    color = '#F59E0B';
    border = 'rgba(245, 158, 11, 0.3)';
  } else if (status === 'FAILED' || status === 'REJECTED' || status === 'SUSPENDED' || status === 'DEBIT' || status === 'ERROR') {
    bg = 'rgba(239, 68, 68, 0.12)';
    color = '#EF4444';
    border = 'rgba(239, 68, 68, 0.3)';
  } else if (status === 'REVERSED') {
    bg = 'rgba(168, 85, 247, 0.14)';
    color = '#C084FC';
    border = 'rgba(168, 85, 247, 0.4)';
  } else if (status === 'DRAFT') {
    bg = 'rgba(14, 165, 233, 0.12)';
    color = '#0EA5E9';
    border = 'rgba(14, 165, 233, 0.3)';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {status || '—'}
    </span>
  );
};

/**
 * HTTP Method Badge Renderer
 */
export const MethodCellRenderer = (params: any) => {
  const method = String(params.value || 'GET').toUpperCase();

  let color = '#0EA5E9'; // GET
  if (method === 'POST') color = '#10B981';
  else if (method === 'PUT') color = '#F59E0B';
  else if (method === 'PATCH') color = '#8B5CF6';
  else if (method === 'DELETE') color = '#EF4444';

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.68rem',
        fontWeight: 800,
        padding: '2px 6px',
        borderRadius: '4px',
        background: `${color}18`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {method}
    </span>
  );
};

/**
 * Micro-USD Price / Latency / Amount Renderer
 */
export const MicroUsdCellRenderer = (params: any) => {
  const val = params.value;
  if (val === undefined || val === null) return '—';

  try {
    const num = typeof val === 'bigint' ? Number(val) : Number(String(val).replace(/[^0-9.-]+/g, ''));
    if (isNaN(num)) return '—';
    const dollars = (num / 1_000_000).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });

    return (
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#FFFFFF' }}>
        {dollars}
      </span>
    );
  } catch {
    return '—';
  }
};

/**
 * Formatted Date Cell Renderer
 */
export const DateCellRenderer = (params: any) => {
  if (!params.value) return '—';
  try {
    const d = new Date(params.value);
    return (
      <span style={{ fontSize: '0.78rem', color: '#9FA4B5' }}>
        {d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    );
  } catch {
    return '—';
  }
};
