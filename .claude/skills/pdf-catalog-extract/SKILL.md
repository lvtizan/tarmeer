---
name: pdf-catalog-extract
description: 从图版产品目录 PDF（每页一款产品、规格印在图里、有水印）扒出高清产品图并结构化成 JSON。适用：厂家发来的画册 PDF（地板/瓷砖/建材等），要按系列/规格入库到网站做展示页。
---

# PDF 产品目录扒图 + 结构化

厂家画册 PDF 往往是**纯图版**：每页是一张合成的高清图（含标题/产品照片/规格表/水印），文字印在图里无法 `pdftotext`。本技能把它变成"结构化产品数据 + 干净高清图"。

## 判断能不能用本技能
```bash
pdfinfo x.pdf | grep Pages
pdftotext x.pdf - | head          # 空 = 纯图版，用本技能
pdfimages -list x.pdf | head      # 看内嵌图分辨率(如 1920x1440)
```

## 流水线（验证于 巴博罗艺术地板 PDF）

### 1. 提取整页高清图 + 渲染页
```bash
pdfimages -all -p x.pdf out/img/p     # 每页导出 1 张彩色 PNG(+灰度 soft mask)，命名 p-<页>-<obj>.png
pdftoppm -png -r 110 x.pdf out/pg/pg  # 渲染每页供 OCR
```
- 每页通常 = **1 张 1920×1440 整页合成图** + 1 张灰度蒙版。真正的产品照片是这张大图里的**区块**，水印只在白底、照片区相对干净。

### 2. 固定比例裁剪出干净照片（版式一致时）
产品页版式固定（如：左上产品板 / 右上规格表 / 左下场景 / 右下细节），按**比例**裁 1920×1440 大图即可批量得到干净照片（避开水印白边）。示例比例（[x,y,w,h] 占比）：
```
board  = [0.052, 0.14, 0.40, 0.38]
room   = [0.052, 0.545, 0.43, 0.43]
detail = [0.505, 0.545, 0.47, 0.43]
```
用 sharp `.extract({left,top,width,height})`（脚本放项目 `scripts/` 下跑，否则找不到 sharp）。**先在 1-2 页目视校准比例**再批量。不同 PDF/系列版式可能不同，分别校准。

### 3. 规格 OCR（视觉识别）
文字在图里 → 用视觉读**渲染页**，逐页抽：产品型号/系列/表面材种/尺寸/表面工艺。页多时**派并行子代理**，每代理读一批渲染页 → JSON，先判 `type`(cover/index/divider/product)再抽规格。

### 4. 产出
- 图：裁出的照片走站点图片管线出多档 WebP；**细节图保原尺不压糊**（地板/材质看纹理）。
- 数据：`{ code, series, seriesEn, wood, size, finish, images:{board,room,detail} }[]` JSON。

## 坑
- 每页"1920×1440"是**整页**尺寸，单张照片裁出来只有 ~700-950px，是源文件上限（渲染更高 DPI 不会更清晰）。
- 水印 tile 在白底层、照片不透，裁照片区可避开；整页直接用会带水印。
- pdfimages/pdftoppm 对大 PDF(200M+MB) 慢，后台跑。
- sharp 脚本必须在有 `node_modules/sharp` 的目录下（放 `scripts/`）。
