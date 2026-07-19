---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

<!-- ============================================================================
组件规格登记表 —— devrules/workflows/design-new-component.md 的产物。
用法：
  1. 复制本表，按项填写（保留小节标题，八项缺一不可）。
  2. 把「Tokens」块合入 DESIGN.md 的 front matter components:，
     把其余 prose 合入 DESIGN.md 的 ## Components 章（新增一个 ### 小节）。
  3. 运行 npm run design:lint 与 npm run design:sync 通过后，才允许开始写组件代码。
============================================================================ -->

### <组件名（英文，与代码文件名一致）>

- **Anatomy**：<由哪些部分组成：容器 / 图标 / 标签 / 辅助文字 / 分隔线…及各部分间距（引用 spacing token）>
- **Variants**：<变体清单与层级关系；每个变体一句话说明何时使用>
- **Sizes**：<sm/md/lg 的高度、内边距、字号（全部引用 token，禁止新造数值；
  确需新数值 → 先在 front matter 增加 token 并在对应章节写明理由）>
- **States**：<状态矩阵，逐个写清视觉变化：
  default / hover / active / focus-visible（必须遵守全局 ring 规则）/ disabled /
  loading / error / selected（按需增删）>
- **Tokens**：<front matter 中登记的键名清单，如 `x-widget(-hover/-active/-disabled)`>
- **Behavior & A11y**：<键盘操作、aria 角色与属性、焦点管理、触摸目标 ≥ 40px 说明>
- **Usage**：<什么时候用它、不用它用什么；与相邻组件的关系；数量/密度限制>
- **Don't**：<本组件专属禁令（至少 2 条，具体可判定）>

**Tokens（合入 DESIGN.md front matter 的 components: 下）**

```yaml
  x-widget:
    backgroundColor: "{colors.<...>}"
    textColor: "{colors.<...>}"
    typography: "{typography.<...>}"
    rounded: "{rounded.<...>}"
    height: <px>
    padding: <值或 "{spacing.<...>}">
  x-widget-hover:
    backgroundColor: "{colors.<...>}"
```

**登记前自检**

- [ ] 复用阶梯已走完：现有组件不可用、扩展 variant 不合理，才新建（结论写在 PR 描述里）
- [ ] 所有颜色成对定义并通过对比度（design-lint 校验 backgroundColor/textColor ≥ 4.5:1）
- [ ] 数值全部来自现有 token；新增 token 已补充到对应章节并说明理由
- [ ] `npm run design:lint` 无 error；`npm run design:sync` 已运行且产物一并提交
