# 花园接口与新增组件指南

## 1. 职责边界

千界花园负责真实研究、证据对象、验证、写入授权和审计；`garden-widgets` 负责适配、快照、展示、画廊和组件测试。主仓库不承载组件页面、客户端模板或展示依赖。

花园继续采用无界面架构。禁止通过静态 HTML 将令牌、实时写权限或未经复核的结论交给浏览器。

## 2. 读取接口

| 用途 | 方法与路径 | 说明 |
|---|---|---|
| 集合 | `GET /api/research/law-packages` | 支持 `kind`、`status`、`q`；返回 `data` 与 `meta.perspectives` |
| 单项 | `GET /api/research/law-packages/{id}` | ID 使用大写字母、数字和连字符 |
| 新建证据对象 | `POST /api/research/law-packages` | 由花园鉴权和校验；组件仓库不直接写入 |

同步时使用两个环境变量：

- `GARDEN_BASE_URL`：默认 `http://localhost:7100`；非回环地址必须是 HTTPS；
- `GARDEN_AGENT_TOKEN`：至少 32 字符，只从同步进程环境读取。

适配器在 URL 中只放过滤条件，不放令牌。令牌仅出现在 HTTP `Authorization: Bearer …` 请求头中，不能写入快照、HTML、日志或错误文本。

## 3. 证据契约

公开 schema 位于 `schemas/law-package.schema.json`。每个规律包必须具有：

- 稳定 ID、正整数版本、对象类型、状态和适用域；
- 命题、摘要和下一项动作；
- 实际指标与参数出生证；
- 分层验证、反例、限制、来源与证据历史。

对象类型：

- `empirical`：经验规律候选；
- `effective_mapping`：尺度、粗粒化和有效映射；
- `formal_constraint`：形式命题、证明与反例；
- `protocol`：研究协议和下一项实验设计。

经验对象使用 `DOMAIN_VALIDATED` 时，必须存在 `independent_replication=PASS`。组件不得自行补写这条记录，也不得在渲染层把 `LIMITED_SUPPORT` 改为更高等级。

## 4. 作者时同步生命周期

1. 花园完成真实研究并保存证据对象；
2. `npm run sync` 读取集合接口并重新校验；
3. 以原始 `{schemaVersion, packages, perspectives}` 计算 SHA-256；
4. 在 `snapshots/history/` 创建新文件，不覆盖旧文件；
5. 更新当前 `snapshots/law-packages.json`；
6. `npm run build` 渲染组件和画廊；
7. `npm test` 再次验证接口和静态策略。

快照只代表生成时的证据，不宣称实时更新。若同步失败，应保留上一个成功快照并报告失败，不能把空结果或错误响应当作新证据覆盖。

## 5. 新增研究叙事组件

研究叙事不必强行伪装成自然定律。它应包含：

```json
{
  "schemaVersion": 1,
  "snapshotType": "research_narrative",
  "title": "组件标题",
  "subtitle": "研究视角",
  "cases": [
    {
      "id": "stable-case-id",
      "label": "短标签",
      "status": "有限状态",
      "tone": "accent | positive | warning | danger",
      "title": "案例标题",
      "summary": "实际结论与边界",
      "metrics": [{ "value": "实际值", "label": "指标", "note": "解释" }],
      "sections": [{ "title": "证据分组", "items": ["可审计条目"] }],
      "boundary": "不能推出的结论",
      "nextAction": "下一项最有价值的动作",
      "sources": [{ "label": "来源", "locator": "定位" }]
    }
  ],
  "sharedRules": ["共享证据纪律"]
}
```

将快照放入 `snapshots/`，在 `scripts/build.mjs` 注册一个定义，选择 `narrativeFromComplexitySnapshot` 或添加同形适配器。构建器负责统一渲染，不应为每个案例复制一套框架。

新增后必须执行 `npm run check`，并至少回答：数据来自哪里、失败在哪里、哪些结论尚未独立复核、如何回到旧快照。

## 6. 静态页面安全契约

- 禁止浏览器 `fetch`、WebSocket、EventSource 和实时花园请求；
- 禁止外部脚本、CDN 样式、远程字体和隐藏令牌；
- 动态文本和 JSON 都必须转义，特别处理所有 `</` 序列，防止闭合脚本注入；
- 预览服务器只允许画廊、组件、快照和接口文档；任意源码文件返回 404；
- 路径必须解码后限制在仓库根目录内；
- 预览服务器只能显式创建，导入模块不得自动监听端口；
- 测试结束必须关闭全部前后端进程。

## 7. 测试与验收

`npm run check` 当前覆盖：

- 内置四个规律包 schema；
- 独立复现晋升门槛；
- 集合与单项适配器、URL、鉴权和无效对象；
- 两类叙事渲染、全部案例、XSS 和敏感字段；
- 重复案例 ID；
- 构建产物与 manifest；
- 预览画廊、组件、快照与任意文件拒绝。

通过测试只证明技术链路，不证明任何科学命题。科学结论仍由对应证据对象及其独立复核决定。
