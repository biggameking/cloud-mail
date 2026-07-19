---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

<!-- ============================================================================
UI 现状审计表 —— 对已有项目做 UI 收编、增强或重构前必填。
使用者：design-adopt-existing-project（收编）、design-refactor-existing-project（Phase 01 现状审计）、
design-audit（定期漂移审计）。
原则：先审计后动手。保留有效资产，清除 AI 味，统一到 DESIGN.md 体系。
============================================================================ -->

# UI 现状审计：<项目 / 范围>

## A. 保留清单（有效资产——重构中丢了算事故）
- 信息架构：哪些导航结构、分组、页面流程是用户已习惯且合理的：
- 品牌资产：logo、插画、图片、图标风格、品牌色、吉祥物、文案音色：
- 有效组件与模式：哪些现有组件/交互模式运转良好，应原样收编进 DESIGN.md：

## B. 清除清单（AI 味内容逐页排查，记录 `文件:行` 或截图）
- [ ] 技术实现说明（"本页面基于 XX 构建""数据存储于…"）
- [ ] 功能介绍段落 / 教学文案（对界面自身的解说；空状态的一句话引导除外）
- [ ] 快捷键 / 操作说明海报块（tooltip 与命令面板里的 kbd 提示除外）
- [ ] 内部机制描述（"点击后将调用 API 刷新缓存"）
- [ ] 占位文案（lorem / 示例文本 / 此处显示…；`npm run design:guard` 的
      no-placeholder-copy 规则可辅助扫描，但人工排查仍是主力）
- [ ] 无意义标签与同义重复（区块标题 = 内容复述；"信息""内容"这类空标签）
- [ ] AI 式营销废话（"强大的""一站式""无缝""重新定义""开启您的…之旅"）
- [ ] 装饰性卡片堆砌、卡中卡、无信息量的图标+短语三列阵
- [ ] 情绪化 emoji 滥用（正文/标题里的 🚀✨🎉）

## C. 统一清单（不一致项 → 收敛到 DESIGN.md token / 组件）
- spacing：发现的间距值分布 → 目标 scale 映射：
- typography：字号/字重/行高的离散值 → 目标级别映射：
- color：近似色聚类结果 → 语义 token 映射：
- radius：圆角档位混用点 → 目标档位：
- component patterns：同类界面的不同实现（如三种表格头、两种弹窗）→ 按复用阶梯合并到哪个组件：

## D. 行动映射（每一项都要有归宿，不允许悬置）
| 发现项 | 处置 | 去向 |
|---|---|---|
| <B/C 中的条目> | 收编 / 修复 / 删除 / 保留 | <DESIGN.md 章节 / 组件 / 直接删除；保留必须写理由> |

## 完成门禁
- [ ] A 清单已写入 DESIGN.md（品牌资产进 Overview/Colors，有效模式进 Components）
- [ ] B 清单逐项清零或登记豁免理由
- [ ] C 清单的映射已执行，`npm run design:guard` 无新增 error
- [ ] 改动后过一遍 `devrules/templates/design-acceptance.md`
