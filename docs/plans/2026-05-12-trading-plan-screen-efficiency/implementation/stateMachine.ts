import type { DensityMode, EditingCell, TradingPlanRow } from './types';
import { getDefaultDensity, shouldHideSparkline } from './density';

export interface ViewState {
  density: DensityMode;
  selectedRowId: string | null;
  drawerOpen: boolean;
  editingCell: EditingCell | null;
  draftValue: string | null;
  saving: boolean;
  error: string | null;
  userSwitchedDensity: boolean;
  hideSparkline: boolean;
}

export type Event =
  | { type: 'INIT'; width: number }
  | { type: 'SWITCH_DENSITY'; mode: DensityMode }
  | { type: 'ROW_CLICK'; rowId: string }
  | { type: 'DRAWER_CLOSE' }
  | { type: 'CELL_DBLCLICK'; rowId: string; field: EditingCell['field']; currentValue: number }
  | { type: 'EDIT_INPUT'; value: string }
  | { type: 'EDIT_CONFIRM' }
  | { type: 'EDIT_CANCEL' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_FAILURE'; message: string }
  | { type: 'RESIZE'; width: number };

export const initialState: ViewState = {
  density: 'compact',
  selectedRowId: null,
  drawerOpen: false,
  editingCell: null,
  draftValue: null,
  saving: false,
  error: null,
  userSwitchedDensity: false,
  hideSparkline: false,
};

export function validateEdit(field: EditingCell['field'], draft: string, row: TradingPlanRow): string | null {
  const value = Number(draft);
  if (!Number.isFinite(value) || value <= 0) return '请输入大于0的有效数字';
  if (field === 'stopLoss' && value >= row.entryPrice) return '止损必须小于入场价';
  if (field === 'targetPrice' && value <= row.entryPrice) return '目标必须大于入场价';
  return null;
}

export function reducer(state: ViewState, event: Event): ViewState {
  switch (event.type) {
    case 'INIT':
      return {
        ...state,
        density: getDefaultDensity(event.width),
        hideSparkline: shouldHideSparkline(event.width),
      };
    case 'SWITCH_DENSITY':
      return { ...state, density: event.mode, userSwitchedDensity: true };
    case 'ROW_CLICK':
      return {
        ...state,
        selectedRowId: event.rowId,
        drawerOpen: true,
        editingCell: null,
        draftValue: null,
        error: null,
      };
    case 'DRAWER_CLOSE':
      return { ...state, drawerOpen: false };
    case 'CELL_DBLCLICK':
      return {
        ...state,
        editingCell: { rowId: event.rowId, field: event.field },
        draftValue: String(event.currentValue),
        error: null,
      };
    case 'EDIT_INPUT':
      return { ...state, draftValue: event.value };
    case 'EDIT_CONFIRM':
      return { ...state, saving: true, error: null };
    case 'SAVE_SUCCESS':
      return {
        ...state,
        saving: false,
        editingCell: null,
        draftValue: null,
        error: null,
      };
    case 'SAVE_FAILURE':
      return { ...state, saving: false, error: event.message };
    case 'EDIT_CANCEL':
      return {
        ...state,
        editingCell: null,
        draftValue: null,
        saving: false,
        error: null,
      };
    case 'RESIZE':
      return {
        ...state,
        density: state.userSwitchedDensity ? state.density : getDefaultDensity(event.width),
        hideSparkline: shouldHideSparkline(event.width),
      };
    default:
      return state;
  }
}
