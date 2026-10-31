# 仓库内容覆盖图

本组件库把研究内容按任务组织，而不是把每个 JSON、日志或源文件机械复制成一个空壳页面。当前共有 **10 个组件**，其中保留原有 3 个，新增 7 个。

## 组件与研究内容

| 组件 | 实际内容 | 主要操作 | 证据边界 |
|---|---|---|---|
| 规律实验室 | 4 类规律包、参数来源、验证、反例和下一项实验 | 切换研究案例、展开证据历史 | 不在页面晋升证据状态 |
| 复杂性与证据控制 | 控制论、诺顿穹顶、形式化、数学工作和公开框架审查 | 案例切换、来源与限制展开 | 方法审查不等于真假宣判 |
| 跨域证据链 | 6 项真实跨库复核及上游互补贡献 | 指标、来源、快照路径查看 | 指定检查不等于新发现 |
| 论文与图件阅览室 | 3 篇完整研究简报、所有章节、13 幅原始图件 | 选论文、全文检索、章节导航、图件放大 | 未同行评议；保留原始限制 |
| CA 表观活性比较 | 6 组文档内 CA I/II 配对及同文档 CA IX 方法对照 | 比值图、同方法筛选、activity 与重复标记查看 | 不做跨文献合并估计，不将 CA IX 与酯酶结果混合 |
| 结构—序列构建对照 | 3HS4／2H4N、三类序列差异、6 个对齐区间、3 个排除候选 | 查看构建、差异、索引、DOI 和采集日期 | 不同构建对照，不是独立野生型重复；260／259 待核 |
| 全球前沿项目协作图谱 | 88 个公开项目，含国家计划、数学、科学智能、生物、物理和基础设施 | 关键词、领域、采用层级、本地状态筛选 | 不声称穷尽全球；verified 只指特定轻量复核 |
| 验证与重放工作台 | 21 份验证结果或上游原始快照、文件哈希和关联脚本 | 搜索、领域与证据类型筛选、标量字段和重放路径查看 | 浏览器不执行科学代码；原始快照不自动升级为验证 |
| 长文预算与恢复规划器 | 花园 1 亿累计 token 预算、分段、重试、超时和检查点约束 | 计算段数、尾段余量与最大计划调用数 | 只读规划，不调用模型、不写稿件，不承诺单次 1 亿 |
| 来源与引用核验 | 39 条书目、15 条注册元数据、4 篇全文、1 篇摘要及真实正文编号 | 按论文、证据层级、原文范围与关键词筛选，展开引文和页码 | 全文只覆盖已读论断；摘要不冒充全文，编号位置按引用组核对 |

## 来源目录如何进入组件

| 上游位置 | 组件去向 |
|---|---|
| `frontier-breakthrough/papers/` | 三篇分稿与 manifest 进入论文阅览室；全部登记 PNG 复制到本仓库 `assets/papers/` |
| `frontier-breakthrough/data/projects.json` | 进入项目图谱，88 个 ID 做唯一性检查 |
| `frontier-breakthrough/validation/` | 21 份 JSON 全部进入验证工作台；活性与结构派生报告另有专用组件 |
| `frontier-breakthrough/scripts/verify_*.py`、`analyze_*.py` | 以可定位的重放路径关联到验证记录；不在浏览器中执行 |
| `frontier-breakthrough/exports/frontier-evidence.json` | 进入跨域证据链，与专用活性／结构组件互补 |
| `frontier-breakthrough/garden/drafts/` | 经修订后的论文进入阅览室；草稿不作为另一套“已验证结论”重复发布 |
| `frontier-breakthrough/docs/GLOBAL_PROJECTS.md` | 其结构化项目目录进入项目图谱；政策与观察项保留来源层级 |
| `frontier-breakthrough/docs/OPENAI_ETH_REVIEW.md` 等讨论材料 | 由复杂性与证据控制及项目条目承载，不把讨论稿伪装成实验结果 |
| `frontier-breakthrough/contracts/` | 继续约束数据接口；不把 schema 文件做成无意义展示页 |
| `frontier-breakthrough/garden/run-report.json`、`service.log` | 属于运行审计，不作为静态科学结论或实时状态发布 |
| `bloombloomgarden/src/lib/manuscript-generation.ts` | 真实生成逻辑留在花园主仓库；本仓库只提供预算规划器 |
| 锁文件、Git 元数据、依赖目录和临时文件 | 不属于研究内容，不生成组件 |

## 更新顺序

在 `frontier-breakthrough` 中先完成真实研究和验证，再于本仓库执行：

```powershell
npm ci
npm run sync:frontier
npm run check
```

如果上游仓库位于其他位置：

```powershell
npm run sync:frontier -- --source "D:\path\to\frontier-breakthrough"
```

同步器只读本地源文件，不调用远程 API，不读取花园令牌。它保存论文、图件、项目与验证快照；构建器再生成所有静态 HTML。上游失败时不得用空数组覆盖上一个成功快照。

`npm run check` 离线重建来源审计与组件，不需要访问 DOI 服务。只有显式运行 `npm run verify:references` 时，才会通过 Crossref／DataCite 回读注册元数据并更新快照；Open Library 与 ACM 官方页面的核对记录单独保存。浏览器组件不执行这些网络请求。

`npm run audit:fulltext` 在本地原始文献已取得后，核对 4 篇完整正文与 1 篇摘要中的 11 条引文及页码，生成带来源 SHA-256 的 `fulltext-evidence.json`。原始 PDF／HTML 仅作为临时核验材料，不随仓库再分发；公开链接、许可范围和证据摘要保存在快照中。该命令不属于离线 CI 的必要步骤。

## 浏览器安全

- 论文 Markdown 在构建期由 `marked` 解析；原始 HTML 被转义，链接协议受限，图片必须来自 manifest 的本地登记文件。
- 动态内容写入 HTML 前进行转义；JSON 中的 `</` 被转义，避免闭合脚本注入。
- 浏览器不使用 `fetch`、WebSocket、EventSource、CDN 或外部脚本。
- 本地预览只开放画廊、组件、文档、快照和登记的 PNG，不开放任意源码或环境文件。
- 页面中的“重放”是路径说明，不代表脚本已经在浏览器或远端运行。
