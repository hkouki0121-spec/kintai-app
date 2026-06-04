/** 給与金額は円未満切り捨て（例: 147.125 → 147、588.5 → 588） */
export function floorYen(y: number): number {
  return Math.floor(y);
}
