# 🌿 庭院设计百宝箱

> Courtyard Design Toolbox · 专业版重构分支

面向庭院业主、景观设计师与工程人员，将空间规划、植物配置、硬景材料、工程构造和造价测算整合为一套可计算、可调整、可复核的庭院设计工具。

**本分支：`rebuild/professional-toolbox`**

---

## 重构原则

- 不使用少量 Mock 数据冒充完整植物库或材料库。
- 主画布只展示已经选入项目的内容，候选植物通过专业选品抽屉筛选。
- 植物按气候区、分类、观赏属性和季相建立结构化数据。
- 图片资产本地化，正式页面不直接热链第三方网站。
- 每张正式图片登记来源、许可、对应条目、图片类型和审核状态。
- 不使用带第三方水印的图片，也不通过去除第三方水印重新利用。
- 卡片价格与 BOQ 调用同一套计价逻辑，杜绝开关前后或不同视图价格不一致。
- 桌面端、移动端和浏览器缩放均属于正式验收范围。

## 专业版主流程

1. **项目参数**：地区/城市、气候区、面积、朝向日照、预算档位、风格及施工工况。
2. **空间配比**：绿化、铺装、水景/构筑物开关与动态比例，总面积严格闭合。
3. **植物配置**：已选乔木、灌木、花境、地被等进入项目清单。
4. **专业选品**：植物分类 × 观赏属性 × 季相月份三级筛选，并支持搜索。
5. **硬景选材**：规格、实景图、损耗、构造断面和 BOQ 联动。
6. **小品与水系**：廊架、景墙、置石、鱼池和过滤系统独立选配。
7. **工程造价**：区域基准、工料机拆解、调差系数和单项穿透编辑。
8. **成果输出**：业主汇报、施工算量、多方案对比和数据导出。

## 图片本地化

本轮已完成图片本地化：400+ 张植物真实照片存放在 `public/assets/plants/`，全部来自 **Wikimedia Commons**（许可明确：CC BY / CC BY-SA / Public Domain），按拉丁学名精确匹配下载，本地压缩至 800px。

- 每张图带完整审核字段：来源页、许可类型与 URL、作者、视觉类型（整株 habit / 细节 detail）、审核方式（auto-reviewed）、置信度、SHA256 哈希
- 乔木优先整株立面图，无法确认的一律标 detail 而不是冒充整株
- 选品卡片直接显示本地缩略图 + 许可标注，图源可点击查看原始页面
- 图片元数据登记在 `src/data/image-candidates.json` 与各 `*.enriched.json` 中

`scripts/fetch-plant-images.mjs`、`retry-plant-images.mjs`、`enrich-verified.mjs`、`add-regional.mjs` 是可复现的抓取脚本（低并发 + 限流退避）。`scripts/compress-and-sync.mjs` 负责压缩并同步哈希。`scripts/audit-assets.mjs` 检查图片路径与重复。

## 数据结构

数据层位于 `src/data/`，采用**两层目录**结构（已核验层 + 导入层，严格分层标注）：

**已核验层（权威）**
- `plants.json`：**32 条 botanical-verified 植物记录**（中文名、拉丁学名、科属、分类、观赏属性、物候月份、分布、来源、审核状态）——植物学事实的唯一权威来源
- `engineering.json`：演示工程参数（规格、单位、密度、演示单价、省份→气候区映射），`status: demo-baseline`
- `materials.json`：8 种硬景材料，含构造层、损耗率、人工/机械/物流/措施拆解
- `features.json`：5 项景观小品与水系选配

**导入层（批量、待复核）**
- `plants.imported.json`：**382 条植物**，从 poke 版线上源码完整抽取（12 个分类：常绿/落叶乔木、果树、花灌木、花境、竹类、藤本、水生、草坪、蕨类苔藓等），含中文名、拉丁学名、规格、功能/观赏属性、适生气候区、演示单价。全部标注 `reviewStatus: imported-unverified`，**未经独立植物学复核**，9 条重复学名已标记
- `materials.imported.json`：**81 项材料**（61 硬景 + 20 软景），含规格、损耗率、工料机演示价、构造断面（61 项硬景均有 buildUp），同样标注 imported-unverified

**查证数据层（本轮新增，可追溯来源）**
- `image-candidates.json`：从 Wikimedia Commons 按拉丁学名抓取的**本地化图片**元数据（来源页、CC 许可、作者、视觉类型、置信度、SHA256、图源关键词打分）
- `price-benchmarks.json`：**234 条公开查证价格**，来自政府造价信息（信息价）、政府采购中标价、苗木行情与批发价；每条带规格、口径、地区、来源 URL、日期
- `plants.enriched.json` / `plants.verified.enriched.json`：把图片、查证价、植物学物候合并进 382 条导入层和 32 条已核验层的增强目录
- `plants.regional.json`：**华南/西南各 30 种乡土适生植物**（拉丁学名经核实、图片本地化），补齐区域覆盖缺口

**合并层**：`src/catalog.js` 负责把各层合并成前端目录（植物共 **474** 条，材料共 **89** 项），并为导入植物自动生成工程参数条目，保证卡片与 BOQ 同价。

**数据分层纪律（红线）**：
- 导入层**绝不得**冒充 `botanical-verified`；选品抽屉按「已核验 / 导入待复核」分层展示
- 图片**全部本地化**到 `public/assets/`，来自许可明确的 Wikimedia Commons，逐张带来源/许可/作者/视觉类型/审核状态；**不加载任何外链图**，图名不符、水印、裂图一律剔除
- 价格优先级：①公开查证基准价（带来源/口径/地区）→ ②poke 原始参考价（明确标注 reference-only）→ ③无价（标注待询价）；**查不到的绝不编造**，卡片与 BOQ 同口径
- 观赏/物候属性来自植物学资料，缺的标 `pending` 不臆造
- “多少种植物 / 多少项材料 / 多少张图”均从实际记录统计，不写死宣传数量

## 自动化验证

核心计算逻辑集中在 `src/core.js`（纯函数），浏览器与 Node 测试共用同一份代码。

```bash
npm run audit   # 植物/图片/工程参数/导入层 四项审计
npm test        # 核心逻辑(22) + 目录合并(10) + DOM 集成(7)
npm run check   # 审计 + 测试（39 项测试）
```

- 审计脚本：`scripts/audit-plants.mjs`、`audit-assets.mjs`、`audit-engineering.mjs`、`audit-imports.mjs`（导入层数据完整性与分层红线校验）
- 单元测试：`tests/core.test.js`（空间配平、筛选、气候匹配、BOQ 平账、工料机拆解、CSV 等）、`tests/catalog.test.js`（两层合并、审核标注、导入植物 BOQ、卡片/BOQ 同价、大数据筛选）
- DOM 集成测试：`tests/dom.integration.test.js`（用 jsdom 加载真实页面与数据，验证目录加载、数据源分层筛选、分页、BOQ、小品联动、汇报视图、导出）
  - 依赖 jsdom，运行时需将 jsdom 置于 Node 模块解析路径；CI 环境请先安装。

**数据可复现脚本**（`npm run` 之外，用 node 直接跑）：
```bash
node scripts/fetch-plant-images.mjs     # 从 Wikimedia 抓取导入层图片
node scripts/retry-plant-images.mjs     # 补抓限流失败项
node scripts/enrich-verified.mjs        # 已核验层补图补价补物候
node scripts/build-prices.mjs           # 整理查证价格库（需 /tmp/price_research.json）
node scripts/integrate-data.mjs         # 合并图片/价格/物候到植物目录
node scripts/add-regional.mjs           # 区域补充植物+抓图（需 /tmp/regional_plants.json）
node scripts/compress-and-sync.mjs      # 图片压缩+哈希同步
```

## 造价模型

**硬景综合单价** = 主材 + 基层/辅材 + 人工 + 机械 + 物流 + 损耗 + 措施

**苗木综合单价** = 苗木采购 + 土球包装 + 运输 + 种植土改良 + 人工/吊装 + 支撑 + 养护质保

未核实的数据明确标识为示例或用户自定义，不冒充权威市场价格。

## 响应式验收

- 视口：390 / 768 / 1024 / 1440 / 1920 px
- 浏览器缩放：50% / 75% / 100% / 125% / 150%
- 禁止横向溢出、图片固定尺寸失衡、悬浮栏遮挡和移动端操作区域裁切。

## 工程说明

本项目定位为庭院方案、选材和前期造价辅助工具。正式施工图、工程量、结构、防水、机电及合同预算仍应结合所在地现行规范、设计文件、现场条件和真实询价复核。

---

**灵感屋 · 庭院设计百宝箱**
