# 正式植物库数据来源台账

正式库不再用“看起来像”作为植物名称、分布和物候依据。每条进入 `plants.json` 的记录必须能回溯到明确植物学来源。

## 已核验种子记录

### 银杏 — Ginkgo biloba L.
- iPlant 植物智：`https://<scrubbed-url-domain>/info/%E9%93%B6%E6%9D%8F?t=focn%60
- PPBC 中国植物图像库：`https://<scrubbed-url-domain>/sp/10533%60
- 已核验字段：中文名、学名、乔木生活型、叶形、秋色、花期、种子成熟期、栽培/分布信息。
- 图片状态：PPBC 页面提供大量实名摄影记录且可按“全株”等类型寻找候选图，但项目暂不复制图片，需先确认具体图片许可。

### 紫丁香 — Syringa oblata Lindl.
- iPlant 植物智：`https://<scrubbed-url-domain>/info/%E7%B4%AB%E4%B8%81%E9%A6%99?t=n%60
- PPBC 中国植物图像库：`https://<scrubbed-url-domain>/sp/26400%60
- 已核验字段：中文名、学名、科属、分布地。
- 图片状态：PPBC 可作为图名物种核对来源；正式本地化前仍需确认具体图片许可。

### 八宝 — Hylotelephium erythrostictum (Miq.) H. Ohba
- iPlant 植物智：`https://<scrubbed-url-domain>/info/%E5%85%AB%E5%AE%9D?t=n%60
- 已核验字段：正式中文名、学名、科属、异名、分布地。
- 重要纠错：iPlant 对“八宝景天”检索会出现另一分类结果，同时提示可能要找长药八宝，因此正式库不再直接把“八宝景天”当成未经核准的标准名。

## 入库纪律

1. 植物学事实来源与工程价格来源分开记录。
2. 没找到明确月份的，不凭经验填花期/果期。
3. 没核实到图片许可的，资产状态保持 `pending-local-license`。
4. 正式图片本地化前需要建立具体图片作者/来源/许可记录，不能仅因网页可浏览就下载公开发布。
5. 乔木候选图优先筛选“全株”记录，再核对树姿、叶形、树皮或果实等识别特征。
