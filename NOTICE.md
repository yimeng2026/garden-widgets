# 来源与复用说明

## marked 18.1.2

论文 Markdown 的构建期解析使用 `marked` 18.1.2。上游地址：`https://github.com/markedjs/marked`，许可证为 MIT。完整许可及 Markdown 相关声明保存在 `THIRD_PARTY_NOTICES.md`。

本仓库仅在作者时构建中调用解析器，没有复制其源码到浏览器组件。浏览器产物不依赖 `marked`、CDN 或远程模块。上游明确说明 Markdown 解析不等于 HTML 消毒，因此本仓库另行转义原始 HTML、限制链接协议并实行本地图片白名单。

## 项目内研究内容

论文、图件、项目目录与验证快照来自同一工作体系的 `frontier-breakthrough`。同步器保留源文件路径、稳定 ID 和验证快照 SHA-256，不把静态复制描述为实时接口。

## 外部数据库与项目

ChEMBL、PubChem、RCSB PDB、UniProt、Materials Project 以及项目图谱中的第三方项目，仍归各自权利人和维护方所有。本仓库只呈现经过选择的公开记录、引用定位和方法审查；后续再分发或使用原始数据时，应遵守相应上游条款。

没有任何第三方模型、数据库或期刊条目因为出现在组件中，就被视为已由本仓库独立验证。
