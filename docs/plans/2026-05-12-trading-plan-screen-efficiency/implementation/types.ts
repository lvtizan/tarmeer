export type DensityMode = 'compact' | 'standard' | 'comfort';
export type Breakpoint = 'lg' | 'md' | 'sm';

export type ColumnKey =
  | 'symbol'
  | 'lastPrice'
  | 'entryPrice'
  | 'stopLoss'
  | 'targetPrice'
  | 'rMultiple'
  | 'status'
  | 'sparkline'
  | 'actions';

export interface TradingPlanRow {
  id: string;
  symbol: string;
  code: string;
  lastPrice: number;
  changePct: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  rMultiple: number;
  status: 'holding' | 'pending' | 'takeProfit' | 'stopLoss';
  sparkline?: number[];
  note?: string;
  buildDate?: string;
  stopDepthPct?: number;
  executionLogs?: string[];
}

export interface ColumnConfig {
  key: ColumnKey;
  title: string;
  width: number;
  minWidth?: number;
  align: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  editable: boolean;
  showAt: Breakpoint[];
  hideBelow?: number;
  className?: string;
}

export interface EditingCell {
  rowId: string;
  field: 'entryPrice' | 'stopLoss' | 'targetPrice';
}
