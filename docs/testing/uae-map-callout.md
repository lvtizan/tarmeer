# Test Cases: UAE Map Callout Cards (collision + drag + dedup)

## Feature Summary

`UAEMapLeaflet.tsx` 地图模块本次改动：

1. **城市去重**：`aggregateCities` 改用「坐标」做规范键（`lat,lng` 4 位精度）。`Dubai` 与 `迪拜`、`Abu Dhabi` 与 `阿布扎比` 现在合并为同一条目；显示名优先中文（`HAS_CJK` 检测）。
2. **卡片高度按行数算**：`cardHeight(city)` 根据 visitor/company/homeowner/inquiry 行数计算，碰撞算法用真实高度。
3. **超界翻面 + viewport clamp**：`computeCardLayout` 同侧总高超过地图高度时把最低优先级的卡换到对面侧；最终把所有卡 y 坐标钳制在 `[16, mapH-16]` 内。
4. **卡片可拖拽**：card marker `draggable: true`，`userMovedRef[i]` 记录已被拖动的卡，后续 `moveend`/`zoomend` 重布局时跳过它们。
5. **去掉圆点呼吸动画**：保留 ring 的 `map-ping`（中心放大→淡出→循环），删除 dot 的 `map-dot-breathe`。

## TC-1：Dubai + 迪拜 合并（aggregateCities）

输入：
- `companyCities = [{ city: 'Dubai', count: 100 }]`
- `visitorCities = [{ city: '迪拜', count: 200 }]`

期望：
- 输出长度 = 1
- entry.city === '迪拜'（中文优先）
- entry.company === 100, entry.visitor === 200, entry.total === 300
- entry.coords === [25.2048, 55.2708]

## TC-2：英文先到 + 中文后到（中文覆盖）

输入：
- 先 push 英文 Abu Dhabi 50（visitor）
- 再 push 中文 阿布扎比 30（company）

期望：
- entry.city === '阿布扎比'（中文覆盖英文）
- entry.visitor === 50, entry.company === 30, entry.total === 80

## TC-3：未识别城市跳过

输入：`companyCities = [{ city: 'Atlantis', count: 999 }]`（不在 CITY_COORDS）
期望：输出长度 0

## TC-4：cardHeight 按行数（紧凑布局）

| city.visitor | city.company | city.homeowner | city.inquiry | 期望 cardHeight |
|---:|---:|---:|---:|---:|
| 0 | 0 | 0 | 1 | 61  (1 行) |
| 1 | 0 | 0 | 1 | 78  (2 行) |
| 1 | 1 | 0 | 1 | 95  (3 行) |
| 1 | 1 | 1 | 1 | 112 (4 行) |

公式：`HEAD_PX(30) + rows * ROW_PX(17) + FOOT_PX(0) + PAD_Y_PX(14)`

紧凑改动：合计数字移到 header 行（与城市名同行右对齐），删除独立 footer；line-height 1.8 → 1.55；行字号 11px → 10.5px；padding 9 → 7。4 行卡 151 → 112（−26%）。

## TC-5：卡片侧边判断（cardSide）

| coords lng | 期望 side |
|---:|:---|
| 54.3773 (阿布扎比) | left |
| 55.2708 (迪拜) | right |
| 55.4209 (沙迦) | right |
| 56.3265 (富查伊拉) | right |

阈值：`lng < 54.9 → 'left'`

## TC-6：computeCardLayout 不留重叠（端到端）

构造 5 张右侧卡（迪拜+沙迦+阿治曼+RAK+富查伊拉），调用 layout。
- 期望：任意两张卡若 x 区间相交，y 区间不相交（GAP=8）。

## TC-7：超界换边

构造 5 张全部右侧的卡，map 高度 480。
- 期望：至少一张被切到 left 侧。

## TC-8：拖拽锁定

E2E (Playwright) — 暂未实现：
- 加载 admin analytics 页
- 拖拽 #1 卡到新位置
- 触发 zoom（pinch / 按 + / 按 -）
- 期望：被拖的卡保持新位置，其它卡自动重布局

## Run Harness

```
node scripts/harness/test-uae-map-callout.mjs
```

期望：所有 TC-1~7 PASS。
