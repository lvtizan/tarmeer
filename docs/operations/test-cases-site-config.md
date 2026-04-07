# Site Config Test Cases

## Scope

This document covers fixed business-facing site configuration that must remain consistent across the public website.

Source of truth:

- [`src/lib/constants.ts`](/Users/kp/Code/tarmeer-4.0-local/src/lib/constants.ts)

Fixed values under test:

- **Address**: `1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates`
- **Google Maps URL**: `https://www.google.com/maps/place/Al+Tameer+United+Building+Materials+Trading+L.L.C/@25.3009785,55.629547,17z/data=!4m6!3m5!1s0x3e5f59cee2235cd5:0xa305167fd1075aa8!8m2!3d25.3006521!4d55.629911!16s%2Fg%2F11xzfmy5zx?entry=ttu&g_ep=EgoyMDI2MDMzMS4wIKXMDSoASAFQAw%3D%3D`
- **WhatsApp**: `+971 58 838 8922`
- **Instagram**: `https://www.instagram.com/tarmeermall`

---

## TC-01: Footer Address Consistency

**前置条件**: 公开站点可访问

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开首页 `/` | 页面正常加载 |
| 2 | 滚动到 footer | 可见 Address 区块 |
| 3 | 检查地址文本 | 显示 `1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates` |
| 4 | 检查 `Google Map` 按钮 | 按钮可见且可点击 |

**验证点**:
- [ ] Footer 地址与 `src/lib/constants.ts` 一致
- [ ] 地址无旧文案、无拼写变体

---

## TC-02: Google Maps Link Consistency

**前置条件**: 公开站点可访问

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开首页 footer 的 `Google Map` | 新标签页打开 Google Maps |
| 2 | 检查打开后的地址 | 指向 `Al Tameer United Building Materials Trading L.L.C` |
| 3 | 检查 URL | 与固定 Google Maps URL 一致 |

**验证点**:
- [ ] Footer 的 `Google Map` 链接使用最新固定地址
- [ ] 无旧版 `Al+Tameer+United+Building+Materials+L.L.C` 简短 URL 残留

---

## TC-03: Contact Page Consistency

**前置条件**: 公开站点可访问

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `/contact` | 页面正常加载 |
| 2 | 检查 showroom/contact 地址块 | 地址文本与固定地址一致 |
| 3 | 点击 `View on Map` | 跳转到固定 Google Maps URL |

**验证点**:
- [ ] `/contact` 地址与 footer 一致
- [ ] `/contact` 地图链接与 footer 一致

---

## TC-04: Showrooms Page Consistency

**前置条件**: 公开站点可访问

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `/showrooms` | 页面正常加载 |
| 2 | 检查 map CTA | 可见 `View on Map` 或等效入口 |
| 3 | 点击地图入口 | 跳转到固定 Google Maps URL |

**验证点**:
- [ ] `/showrooms` 地图链接与 footer 一致

---

## TC-05: WhatsApp & Instagram Consistency

**前置条件**: 公开站点可访问

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开首页 footer | 可见 WhatsApp 和 Instagram 入口 |
| 2 | 点击 WhatsApp | 跳转 `https://wa.me/971588388922` |
| 3 | 点击 Instagram | 跳转 `https://www.instagram.com/tarmeermall` |

**验证点**:
- [ ] WhatsApp 号码与固定业务号码一致
- [ ] Instagram 链接与固定业务账号一致

---

## TC-06: Constants Source-of-Truth Review

**代码检查**: [`src/lib/constants.ts`](/Users/kp/Code/tarmeer-4.0-local/src/lib/constants.ts)

| 场景 | 预期 |
|------|------|
| `ADDRESS` | 固定为业务地址 |
| `GOOGLE_MAPS_URL` | 固定为最新地址详情页 URL |
| `WHATSAPP_NUMBER` | 固定为 `971588388922` |
| `INSTAGRAM_URL` | 固定为 `https://www.instagram.com/tarmeermall` |

**验证点**:
- [ ] 公共页面统一从 constants 读取
- [ ] 修改业务联系方式时，先更新 constants，再回归 TC-01 ~ TC-05
