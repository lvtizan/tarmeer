import React, { useMemo, useReducer } from 'react';
import columnsJson from '../columns.json';
import { reducer, initialState, validateEdit } from './stateMachine';
import type { TradingPlanRow } from './types';

interface Props {
  rows: TradingPlanRow[];
  onPatchRow: (rowId: string, patch: Partial<TradingPlanRow>) => Promise<void>;
}

export function TradingPlanTable({ rows, onPatchRow }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const visibleColumns = useMemo(() => {
    return columnsJson.columns.filter((c) => !(state.hideSparkline && c.key === 'sparkline'));
  }, [state.hideSparkline]);

  async function commitEdit() {
    if (!state.editingCell || state.draftValue == null) return;
    const row = rows.find((r) => r.id === state.editingCell!.rowId);
    if (!row) return;

    const err = validateEdit(state.editingCell.field, state.draftValue, row);
    if (err) {
      dispatch({ type: 'SAVE_FAILURE', message: err });
      return;
    }

    dispatch({ type: 'EDIT_CONFIRM' });
    try {
      await onPatchRow(row.id, { [state.editingCell.field]: Number(state.draftValue) });
      dispatch({ type: 'SAVE_SUCCESS' });
    } catch (e) {
      const message = e instanceof Error ? e.message : '保存失败';
      dispatch({ type: 'SAVE_FAILURE', message });
    }
  }

  return null;
  // 这里按你项目的表格组件接线：
  // - row click => dispatch({type:'ROW_CLICK', rowId})
  // - cell dblclick => dispatch({type:'CELL_DBLCLICK', ...})
  // - input change => dispatch({type:'EDIT_INPUT', value})
  // - enter/blur => commitEdit()
  // - esc => dispatch({type:'EDIT_CANCEL'})
  // - close drawer => dispatch({type:'DRAWER_CLOSE'})
}
