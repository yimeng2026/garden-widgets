# 花园组件库

独立、可审计的研究组件与静态证据快照。千界花园继续只提供无界面研究 API；本仓库负责组件渲染、画廊、同步和测试，避免把展示资产堆回主仓库。

## 当前组件

- **规律实验室**：CA2 冻结规则留出验证、材料带隙对象完备性、可逆但不稳定的反演反例、竞争模型主动判别。
- **复杂性与证据控制**：智能体控制论、诺顿穹顶与形式化、2025 三项数学工作、罗文俊·探索者及公开框架审查。
- **跨域证据链**：PySINDy、Z3、PubChem/RDKit、Materials Project/PyMatGen、PDB/UniProt、ChEMBL/PubChem/PDB 的六项真实复核，显示算法口径、快照与上游互补贡献。
- **论文与图件阅览室**：三篇完整研究简报、篇内全文检索、章节导航与 13 幅图件放大。
- **CA 表观活性比较**：六组文档内 Ki 配对、同方法筛选、重复标记和 CA IX 方法边界。
- **实验方法血缘**：六篇文档的方法指纹、来源角色、外部上下文排除、15 组比较和独立实验边界。
- **结构—序列构建对照**：3HS4／2H4N 的三类构建差异、完整对齐区间、排除候选和长度元数据不一致。
- **全球前沿项目协作图谱**：88 个公开项目按领域、采用层级、本地状态和关键词筛选，强调与上游协作而非重复包装。
- **验证与重放工作台**：21 份验证或上游快照、SHA-256、标量记录和关联重放脚本。
- **长文预算与恢复规划器**：最高 1 亿累计 token 的分段、尾段、重试和恢复规划；不调用模型。
- **来源与引用核验**：39 条书目逐条关联 DOI／目录元数据、软件版本、数据库快照和本地证据；真实编号覆盖 12／12、8／8、19／19；4 篇全文与 1 篇摘要分级展示引文、页码和边界。

所有组件都显示证据状态、反例、限制和下一项动作。页面不自行提升结论，不把形式证明、数据库留出、数值演示和独立实验复现混为一谈。仓库内容映射与更新路径见 `docs/CONTENT_COVERAGE.md`。

## 架构

```text
花园研究 API
  ↓ 作者时同步（GARDEN_AGENT_TOKEN 仅存在于同步进程）
带 SHA-256 的证据快照 + 不覆盖的历史
  ↓ 构建与自动检查
无令牌、无 CDN、无浏览器 fetch 的静态 HTML
  ↓
本地画廊 / Kimi 小组件
```

## 安装与验证

需要 Node.js 22 或更高版本，无第三方运行时依赖。

```powershell
npm ci
npm run check
```

`check` 先构建，再运行接口、schema、XSS、凭据泄漏、重复案例、静态网络和预览路径测试。`npm run qa:browser` 另使用本机 Edge 的隔离临时配置执行桌面／移动端交互与截图检查；结束时关闭浏览器和预览服务，不读取个人浏览器会话。

## 本地预览

```powershell
npm run dev -- --host 127.0.0.1 --port 7100
```

打开 `http://localhost:7100/`。开发服务器只提供画廊、组件、快照和接口文档，不启动花园，也不提供写接口。

## 从花园同步

先启动花园研究 API，再设置环境变量：

```powershell
$env:GARDEN_BASE_URL = "http://localhost:7100"
$env:GARDEN_AGENT_TOKEN = "your-long-random-token"
npm run sync
```

同步执行以下操作：

1. 读取 `GET /api/research/law-packages`；
2. 校验每个证据对象及 `empirical DOMAIN_VALIDATED` 的独立复现要求；
3. 在 `snapshots/history/` 新增带时间和 SHA-256 的快照；
4. 更新当前快照并重建组件；
5. 检查浏览器网络访问、外部依赖、重复 ID 和敏感信息。

不要提交真实令牌。`.env` 和常见日志、临时文件已在 `.gitignore` 中排除。

## 目录

```text
src/
  contracts.mjs                  证据契约、ID、来源状态、HTML 转义
  garden-adapter.mjs            花园只读接口与鉴权
  research-renderer.mjs         共享叙事渲染与静态策略
  research-widget-template.html  原有研究案例组件模板
  content-explorers.mjs         七类新组件的数据适配与安全 Markdown 渲染
  content-explorer-template.html 新组件共享的交互壳
scripts/
  sync-law-packages.mjs         花园证据作者时同步
  sync-frontier-content.mjs     本地论文、图件、项目与验证快照同步
  verify-reference-metadata.mjs DOI 注册元数据作者时回读
  build-reference-audit.mjs     39 条来源、版本、快照与引用关联审计
  verify_fulltext_evidence.py   4 篇全文、1 篇摘要的引文与页码核验
  build.mjs                     构建 11 个组件与画廊
  dev.mjs                       显式创建的安全预览服务器
schemas/
  law-package.schema.json       公开 JSON Schema
snapshots/
  law-packages.json            当前规律包快照
  complexity.json              当前复杂性研究快照
  frontier-evidence.json       当前跨域证据快照
  paper-collection.json        三篇论文全文与图件登记
  projects.json                88 个全球公开项目
  validation-records.json      21 份验证或上游快照及 SHA-256
  reference-metadata.json      13 条 DOI 注册元数据
  reference-supplement.json    图书馆目录与 ACM 官方政策元数据
  reference-audit.json         39 条来源与正文关联审计
  method-lineage-ca-six.json   六篇文献的方法血缘快照
  history/                     不覆盖的历史快照
assets/papers/                 13 幅本地论文原图
widgets/                       11 个独立静态组件与 manifest
tests/                         Node 内置测试，无额外测试框架
```

## 边界

- 当前组件是**作者时证据快照**，不是实时仪表盘；未创建定时任务或自动晋升。
- 书籍《工业级智能体控制论》属于 `dpsnet`，不是 `KrisTHL181`。Lean 当前只做源码静态计数，未在本机构建。
- 流体方程结果是希尔伯特第六问题的重要情形；随机曲面是概率趋一结论；Kakeya 仅三维。
- 罗文俊·探索者及其他公开理论只作方法与证据审查，不作身份推断或未经核验的真假宣判。

新增组件与接口细节见 `docs/GARDEN_INTERFACE.md`。
