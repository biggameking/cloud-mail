---
title: "Cloud Mail 自定义域名邮箱实施与二次开发说明书"
subtitle: "需求说明（PRD）· 技术设计 · Cloudflare 部署手册"
author: "适用仓库：maillab/cloud-mail"
date: "文档版本 1.0 · 2026-07-14"
lang: zh-CN
---

> **文档用途**：本说明书可直接放入仓库的 `docs/CUSTOM_DOMAIN_MAIL_IMPLEMENTATION.md`，作为产品需求、技术方案、开发拆解、部署、测试和验收依据。示例域名统一使用 `example.com`，管理台使用 `mail.example.com`；实施时请替换为你的真实域名。
>
> **基线要求**：开发开始前先固定上游版本并记录 Commit，不要长期直接跟随浮动的 `main`。建议创建自己的 Fork，建立 `upstream` 远端，并把每次上游同步作为独立 PR 处理。

# 一、执行摘要

## 1.1 结论

`maillab/cloud-mail` **可以作为自定义域名邮箱的 Web 管理台和 Webmail 基础项目**。仓库已经具备：一个或多个自定义域名、多邮箱地址、邮件接收、网页端发信、附件、用户与角色权限、Cloudflare D1/KV/R2、Resend 发信、邮件转发及管理页面等能力。

但它并不是传统的完整邮件服务器：

- 不为每个邮箱提供独立的 IMAP / POP3 / SMTP 登录账号；
- 入站邮件依赖 Cloudflare Email Routing 把邮件交给 Email Worker；
- 网页端向外发信依赖 Resend、Cloudflare Email Sending，或本项目新增的 SMTP2GO 适配器；
- 现有外部邮箱转发主要是系统级设置，不能完整表达“每个域名邮箱独立选择不同常用邮箱”；
- 免费层适合低量个人或小团队使用，不适合营销群发或高吞吐邮件系统。

因此，本项目的准确定位是：

> **一个基于 Cloudflare 的多地址域名邮箱控制台。所有入站邮件先进入 Worker 并保存在 Webmail，再根据邮箱级规则转发到你的常用 Gmail、Outlook 或其他已验证邮箱；网页端发信由可切换的发送服务完成。**

## 1.2 与你的需求的匹配结果

| 你的需求 | 能否实现 | 实现方式 |
|---|---|---|
| 使用自己的域名 | 可以 | Cloudflare DNS + Email Routing |
| 创建很多域名邮箱 | 可以 | 管理台在 D1 中创建逻辑邮箱；Catch-all 统一进入 Worker，无须为每个地址创建 Cloudflare 路由规则 |
| 每个邮箱正常收信 | 可以 | Email Routing → Worker → PostalMime 解析 → D1/R2 存储 |
| 每个邮箱正常发信 | 可以 | Webmail → Resend（默认）/ SMTP2GO / Cloudflare Email Sending |
| 收到邮件转发到常用邮箱 | 可以 | Worker 调用 `message.forward()`；目标必须在 Cloudflare 中完成验证 |
| 不同邮箱配置不同转发目标 | 需要二次开发 | 增加 `forward_target`、`account_forward_rule` 和管理页面 |
| 在可视化控制台统一管理 | 可以 | 复用现有 Vue 管理台，并新增“转发目标、转发规则、投递日志、发送服务”页面 |
| 尽可能免费 | 可以起步 | Workers Free + Email Routing + D1/KV/R2 Free + Resend Free；达到资源或发信限额后再升级 |
| 在 Gmail 中直接以域名地址回复 | 可选实现 | Gmail“用其他地址发送邮件”+ SMTP2GO；或直接在 cloud-mail Webmail 回复 |
| Apple Mail/Outlook 作为独立邮箱账号登录 | 本方案不支持 | 需要真正的 IMAP/SMTP 托管服务，或另行建设邮件服务器 |

## 1.3 推荐的落地路线

### V0：最低改动、先跑通

- Cloudflare DNS 托管域名；
- 每个域名开启 Email Routing；
- Catch-all 只指向 `cloud-mail` Email Worker；
- 使用现有 D1、KV、R2 和 Vue 管理台；
- 使用仓库原生支持的 Resend Free 发信；
- 暂时使用现有全局转发，把所有命中邮件转到一个已验证的常用邮箱；
- 默认关闭公开注册和公共批量建号，只由管理员创建邮箱；
- 完成本文列出的 P0 安全修复后再开放公网。

这个版本可以快速验证：域名解析、收件、附件、发件、外部转发和管理台是否都满足你的日常使用。

### V1：推荐生产版

在 V0 上增加：

- 每个邮箱独立的转发开关和目标；
- 一个邮箱可转发到多个已验证目标；
- 转发目标验证状态管理；
- 入站、转发和发信投递日志；
- Resend / SMTP2GO / Cloudflare 统一发送适配层；
- 邮件去重、软删除恢复、安全隔离和密钥治理；
- 管理员创建邮箱、用户只能管理自己邮箱的 RBAC；
- 监控、备份、回滚和配额告警。

### V2：按实际用量增强

只有出现明确需求时再建设：

- 原始 MIME 保存与失败重放；
- Cloudflare Queues / Workflows 异步任务；
- 多租户、团队和审计日志；
- 自助申请邮箱与审批；
- 更高级的垃圾邮件规则；
- 多发送服务故障切换；
- 邮件生命周期和归档策略。

## 1.4 上线前阻断项

以下项目未完成时，不建议将管理端直接暴露在公网：

1. 修复 `mail-worker/src/service/public-service.js` 批量建号中的字符串拼接 SQL，全部改为参数化绑定；
2. 限制 CORS，不再允许任意 Origin；
3. 将 JWT、Resend、SMTP2GO、Cloudflare Token 等敏感值移入 Worker Secrets；
4. 初始化接口仅在部署阶段短时可用，初始化后禁用或改成受保护的迁移命令；
5. 对外部邮件 HTML 使用沙箱 iframe 或严格白名单清洗，避免存储型 XSS；
6. 修复软删除邮箱不能安全重建、以及旧邮件误绑定给新用户的风险；
7. 默认关闭公开注册、公共 Token 和公共批量建号；
8. 增加登录、建号、发信、转发规则修改的限流和审计；
9. 对未知收件地址默认拒收，Catch-all 不等于“所有随机地址都存入系统”；
10. 为 D1 与 R2 建立可验证的备份和恢复流程。

# 二、业务目标、范围与术语

## 2.1 业务目标

系统上线后应满足：

1. 支持一个或多个自有域名，例如 `example.com`、`example.net`；
2. 管理员可创建 `hello@example.com`、`invoice@example.com`、`shop-a@example.com` 等大量逻辑邮箱；
3. 外部发件人可正常投递，邮件在控制台中可查、可读、可下载附件；
4. 用户可选择自己拥有的域名地址作为 From，在 Webmail 中向外发信；
5. 每个邮箱可以独立配置转发到一个或多个常用邮箱；
6. 转发后仍在 cloud-mail 中保留副本，避免外部邮箱过滤或故障导致邮件不可追溯；
7. 管理员可以管理域名、用户、邮箱、角色、配额、转发目标、转发规则、发送服务和日志；
8. 在低邮件量阶段优先使用免费层，并能明确判断什么时候需要升级；
9. 对配置错误、发信限额、转发失败和附件异常有可定位日志；
10. 上游仓库可以持续同步，但二次开发不会因一次同步被覆盖。

## 2.2 角色定义

| 角色 | 主要权限 |
|---|---|
| 系统管理员 | 域名、用户、邮箱、角色、发送服务、转发目标、系统设置、安全、日志、部署与备份 |
| 邮箱用户 | 查看自己拥有的邮箱；收发邮件；配置自己邮箱的转发规则；查看自己的投递结果 |
| 运维人员 | 查看服务状态、配额、失败日志、备份与发布记录；默认不读取邮件正文 |
| 审计人员（可选） | 只读查看配置变更、登录、建号、规则和发信审计，不具备修改权限 |

## 2.3 “邮箱”的定义

本文中的“邮箱”有三层含义：

- **域名邮箱地址**：例如 `sales@example.com`；在 D1 的 `account` 中存在；
- **Webmail 账户**：用户登录 cloud-mail 后管理一个或多个域名邮箱地址；
- **外部常用邮箱**：例如个人 Gmail/Outlook，用作邮件转发目标和账号恢复地址。

一个用户可以拥有多个域名邮箱；一个域名邮箱在 V1 中可以关联多个转发目标。

## 2.4 “正常收发”的定义

本项目中的“正常收发”是指：

- 外部发件人能够向域名地址投递；
- Worker 能够解析、保存正文和附件；
- 邮件可在 Webmail 中查看，并可按规则转发；
- 用户能够在 Webmail 中选择自己的域名地址发信；
- SPF、DKIM、DMARC 能通过主流收件系统的基础认证检查；
- 退信、限额、转发错误和服务商错误有记录可查。

它**不代表**该邮箱可以作为一个独立 IMAP/SMTP 账号添加到 Apple Mail、Outlook 或 Thunderbird。

## 2.5 本期范围

本期包含：

- 多域名、多邮箱地址；
- Webmail 收件、发件、回复、附件；
- 邮箱级外部转发；
- 常用邮箱目标与验证状态；
- Resend 默认发信；
- SMTP2GO 可选发送适配器；
- Cloudflare Email Sending 可选适配器；
- RBAC、配额、日志和安全加固；
- Cloudflare 部署、DNS、测试与验收。

本期不包含：

- IMAP / POP3 服务；
- 为每个地址发放 SMTP 用户名与密码；
- Autodiscover、日历、通讯录或 Exchange ActiveSync；
- 大规模营销群发；
- 自建 MTA、独立公网 IP、PTR 和 IP 信誉运营；
- 法律意义上的长期合规归档系统；
- 端到端加密邮箱。

# 三、现有仓库能力评估

## 3.1 仓库定位与技术栈

仓库当前定位为基于 Cloudflare 的邮箱服务，主要技术栈包括：

- Cloudflare Workers；
- Hono；
- Drizzle ORM；
- Vue 3 + Element Plus；
- Cloudflare D1、KV、R2；
- PostalMime；
- Resend；
- 可选 Cloudflare `send_email` binding；
- Turnstile、Workers AI、ECharts。

仓库将前端静态资源与 Worker 绑定，`wrangler.toml` 的构建命令会先构建 `mail-vue`，再随 Worker 一起部署，因此非常适合做单 Worker 的管理台和 API。

## 3.2 当前能力映射

| 需求 | 当前状态 | 本项目处理方式 |
|---|---|---|
| 一个域名创建多个邮箱 | 已支持 | 复用 `account`、`user` 和角色配额 |
| 多个域名 | 已支持 | `env.domain` 为数组；角色可限制可用域名 |
| 接收外部邮件 | 已支持 | Email Routing → Worker `email()` handler |
| 保存邮件与附件 | 已支持 | D1 保存结构化数据，R2/S3 保存附件 |
| 网页端发信 | 已支持 | 当前优先 Cloudflare binding，否则 Resend |
| 管理台和 RBAC | 已支持 | 复用现有用户、角色、权限和菜单机制 |
| 外部邮箱转发 | 部分支持 | 当前为系统级设置；扩展成邮箱级规则 |
| 每个邮箱独立转发目标 | 不完整 | 新增三张业务表与 API/UI |
| 投递日志 | 不充分 | 新增统一 `delivery_log` |
| SMTP2GO | 未支持 | 新增 provider adapter |
| IMAP / POP3 | 不支持 | 明确排除，不在本仓库中硬做 |
| 安全基线 | 需要补强 | SQL、CORS、Secrets、HTML、初始化、软删除等 |

## 3.3 现有入站流程

当前 `mail-worker/src/email/email.js` 已经包含：

1. 读取 Email Worker 提供的原始邮件流；
2. 使用 PostalMime 解析 MIME；
3. 根据主题、正文、发件人黑名单决定是否拒收；
4. 按收件地址查找 `account`；
5. 检查用户角色和域名权限；
6. 保存邮件正文与附件；
7. 读取系统级转发开关、目标及来源规则；
8. 调用 `message.forward(destination)`。

因此无需重写整个收件系统。二次开发重点是：把“全局转发配置”重构为“邮箱级规则引擎”，并补齐幂等、日志、安全与管理界面。

## 3.4 现有发信流程

当前 `mail-worker/src/service/email-service.js` 会：

- 校验当前用户是否拥有 From 邮箱；
- 校验角色是否允许使用该域名；
- 校验是否只允许站内发信；
- 校验每日或累计发信配额；
- 区分站内收件人和站外收件人；
- 有 Cloudflare Email binding 时优先使用；
- 否则根据域名选择 Resend Token；
- 保存发件记录、附件和回复关系。

本项目应保留这些业务校验，仅把具体供应商调用抽象为统一接口，并加入 SMTP2GO。

## 3.5 现有转发能力边界

现有系统设置中的：

- `forward_status`；
- `forward_email`；
- `rule_email`；
- `rule_type`；

可以做到“系统整体开启转发，并按来源列表筛选”。如果所有域名邮箱都只转到同一个 Gmail，可以先用它做 V0。

但它不能完整处理：

- `sales@example.com` 转到 A；
- `invoice@example.com` 转到 B；
- `shop@example.com` 同时转到 A 和 C；
- 普通用户只能修改自己邮箱的规则；
- 管理员查看每一次转发的成功、失败和原因；
- 目标验证状态变化后的自动停用；
- 转发回路检测和重复投递去重。

## 3.6 当前安全和维护风险

根据当前主分支代码与公开 Issue，至少关注：

- `public-service.js` 的批量建号仍使用字符串拼接生成 INSERT SQL；
- Hono 当前全局 `cors()`，默认过宽；
- 安全中间件依赖手工维护路由与权限映射，新增 API 时容易漏配；
- 初始化路径在排除认证的范围内，必须严格控制生命周期；
- 部分密钥可由管理台写入设置存储，生产环境应改用 Worker Secrets；
- 邮件 HTML 和 Telegram 预览曾出现存储型 XSS 风险；
- 软删除邮箱存在重新注册冲突，需要明确“恢复、重建、清除旧数据”的语义；
- 公共批量建号 Token 一旦泄露，影响范围较大。

# 四、目标架构

![目标系统架构](assets/architecture.png){width=96%}

## 4.1 架构说明

1. 域名由 Cloudflare DNS 管理，Email Routing 自动配置或要求配置 MX；
2. 每个域名只需要一条 Catch-all → Email Worker 路由；
3. Worker 接收所有入站邮件后，再根据 D1 中是否存在目标 `account` 决定接收或拒绝；
4. 合法邮件先存入 D1/R2，再执行邮箱级转发；
5. 管理台与 API 由同一 Worker 提供，静态资源通过 Workers Assets 服务；
6. Webmail 发信进入统一 Provider Adapter；
7. 转发目标使用 Cloudflare 已验证的 Destination Address；
8. D1 保存关系数据，KV 仅存短期状态、会话和计数，R2 存附件及可选原始 MIME。

## 4.2 关键设计原则

### 所有入站邮件必须先到 Worker

不要把 Catch-all 直接指向 Gmail。否则邮件绕过 cloud-mail，无法保存、过滤、审计，也无法执行不同邮箱的独立转发规则。

### Catch-all 负责入口，不负责接受所有地址

Catch-all 只把流量交给 Worker。Worker 必须查询 `account`：

- 地址存在且启用：接收；
- 地址不存在：默认 `message.setReject('Recipient not found')`；
- 地址已停用或域名未授权：拒收；
- 仅当显式开启“临时收件/未知地址收件”功能时，才允许特殊处理。

这使你可以创建大量邮箱，但不会把随机垃圾地址全部存入系统。

### 先存储，后转发

转发失败不能导致 Webmail 中的邮件丢失。默认行为为：

1. 验证收件地址；
2. 解析并保存；
3. 提交事务或确认保存成功；
4. 再执行转发；
5. 写入投递日志。

### 转发目标必须验证

Cloudflare Email Routing 的 `message.forward()` 只能转发到账号中已验证的 Destination Address。管理台只能展示“待验证/已验证/失效”状态，不能绕过用户在目标邮箱中点击验证链接这一环节。

### 密钥与业务配置分离

- 非敏感配置：可存 D1；
- API Key、JWT Secret、Cloudflare Token：Worker Secrets；
- 前端永远不能拿到密钥原文；
- 日志中必须对 Token、密码、Cookie 和完整邮件正文脱敏。

### 发送服务可替换

业务层只调用统一接口，不直接依赖 Resend、SMTP2GO 或 Cloudflare 返回结构。切换供应商时，不修改“权限、配额、保存发件记录”等业务逻辑。

## 4.3 推荐部署拓扑

| 组件 | 推荐值 |
|---|---|
| 管理台域名 | `mail.example.com` |
| 邮箱域名 | `example.com`；可继续增加其他域名 |
| Worker | `cloud-mail-prod` |
| D1 | `cloud-mail-prod-db` |
| KV | `cloud-mail-prod-kv` |
| R2 | `cloud-mail-prod-attachments` |
| 发信服务 | V0/V1 默认 Resend；可选 SMTP2GO |
| 外部转发目标 | 你的 Gmail/Outlook，先在 Cloudflare 验证 |
| 入站路由 | Catch-all → Worker |
| 环境 | `dev`、`staging`、`prod` 分开资源和密钥 |

# 五、功能需求

## 5.1 域名管理

### FR-DOMAIN-001 添加域名

管理员可以添加一个或多个邮箱域名。每个域名至少保存：

- 域名；
- 启用状态；
- Email Routing 状态；
- MX 检查状态；
- SPF、DKIM、DMARC 检查状态；
- 默认发送服务；
- 默认转发策略；
- 创建和更新时间。

第一期可以继续从 `env.domain` 读取允许域名；V1.1 再迁移到 D1 `mail_domain` 表。迁移期间应以环境变量为允许列表上限，D1 只能启用其中已有域名，避免管理台被入侵后私自添加域名。

### FR-DOMAIN-002 DNS 检查

管理台提供只读检查：

- MX 是否指向 Cloudflare Email Routing；
- SPF 是否存在且只有一条 `v=spf1` 记录；
- 发送服务的 DKIM CNAME/TXT 是否生效；
- DMARC 是否存在；
- 管理台自定义域名是否解析到 Worker；
- Email Routing 是否启用。

DNS 检查失败不自动改 DNS，避免过度申请 Cloudflare Token 权限。需要全自动时再增加最小权限 API Token。

## 5.2 邮箱地址管理

### FR-ACCOUNT-001 创建邮箱

管理员可以创建：

- 邮箱地址；
- 显示名称；
- 所属用户；
- 所属域名；
- 状态；
- 接收开关；
- 发信开关；
- 默认发送服务；
- 转发开关；
- 标签/备注。

邮箱本地部分应进行统一规范：去掉首尾空格、转小写、禁止控制字符、限制长度，并使用数据库唯一约束防止重复。

### FR-ACCOUNT-002 批量创建

管理员可以粘贴 CSV 或列表批量创建邮箱。必须满足：

- 每条输入参数化写入；
- 单次最多 100 条，防止超时；
- 先校验全部数据，再分批事务写入；
- 返回逐条成功/失败原因；
- 记录操作者、IP、User-Agent 和请求 ID；
- 不使用公共长期 Token；
- 默认不接受调用方传入任意角色名，角色必须在管理员允许范围内。

### FR-ACCOUNT-003 删除与恢复

采用软删除时必须定义：

- “停用”：不收不发，但保留所有数据；
- “删除”：进入回收站，默认 30 天；
- “恢复”：恢复原账号、原归属和规则；
- “永久删除”：清理邮箱、规则、附件引用和索引；
- “重建同名邮箱”：必须由管理员明确选择是否继承旧邮件，默认不继承。

不能简单地让新用户绑定旧的 `account` 记录，否则可能泄露旧邮件。

### FR-ACCOUNT-004 地址数量

系统本身不需要为每个邮箱创建一条 Cloudflare 路由规则。Catch-all 统一进入 Worker，因此逻辑邮箱数量主要受 D1、业务配额和管理策略限制，而不是 Email Routing 每域 200 条规则限制。

## 5.3 收件箱与邮件查看

### FR-MAIL-IN-001 接收与存储

系统保存：

- Envelope From / To；
- Message-ID；
- From、To、Cc；
- Subject；
- 文本正文；
- 清洗后的 HTML 正文；
- 收件时间；
- 附件元数据与 R2 Key；
- SPF/DKIM/DMARC 或可获得的认证结果；
- 大小；
- 处理状态；
- 去重 Key；
- 关联邮箱和用户。

### FR-MAIL-IN-002 HTML 安全

邮件正文默认在 sandbox iframe 中展示：

- 禁止脚本；
- 禁止同源权限；
- 默认阻止外部图片和追踪像素；
- 用户可单次选择加载远程图片；
- URL 使用安全跳转提示；
- 对危险标签和事件属性做服务端清洗；
- 不把原始 HTML 拼入 JavaScript 模板字符串。

### FR-MAIL-IN-003 附件

- 入站总大小遵循 Cloudflare 上限；
- 单附件设置应用级上限，例如 20 MiB；
- 文件名清洗，禁止路径穿越；
- 下载接口做用户归属校验；
- R2 对象默认私有，通过短时签名或 Worker 鉴权下载；
- 禁止将可执行 HTML/SVG 直接以内联同源方式打开；
- 保存 MIME Type、大小、哈希和扫描状态。

## 5.4 发信

### FR-MAIL-OUT-001 选择发件地址

用户只能选择自己拥有且启用的邮箱。管理员也应通过显式“代发”权限，而不是天然可以冒充所有地址。

### FR-MAIL-OUT-002 发送前校验

- 发件地址归属；
- 域名权限；
- 邮箱状态；
- 用户与角色配额；
- 单封收件人数；
- 附件大小；
- 收件地址格式；
- 发送服务配置；
- 幂等请求键；
- 频率限制与反滥用。

### FR-MAIL-OUT-003 回复

回复应设置：

- `In-Reply-To`；
- `References`；
- 原始 Message-ID 关联；
- 正确的 From；
- 对话线程 ID。

从外部常用邮箱直接回复时，默认会使用外部邮箱地址。要显示为域名地址，必须在 Gmail/Outlook 中另行配置“用其他地址发送”，推荐搭配 SMTP2GO；这与 cloud-mail 自身转发是两件事。

## 5.5 转发目标管理

### FR-FWD-TARGET-001 添加目标

目标字段：

- 目标邮箱；
- 显示名称；
- 所属用户或系统级；
- Cloudflare 验证状态；
- 状态更新时间；
- 是否启用；
- 备注。

添加目标后，页面提示管理员前往 Cloudflare Email Routing 的 Destination Address 中添加并完成验证。可选地使用 Cloudflare API 读取状态，但不把“标记为已验证”的高权限操作交给应用。

### FR-FWD-TARGET-002 共享范围

- 私有目标：仅所属用户可用；
- 共享目标：管理员授权给指定用户或角色；
- 系统目标：仅管理员可选，用于统一归档或告警。

### FR-FWD-TARGET-003 目标状态

状态至少包括：

- `pending`：尚未确认；
- `verified`：可转发；
- `disabled`：人工停用；
- `invalid`：Cloudflare 中不存在或验证失效。

规则只允许选择 `verified` 且启用的目标。

## 5.6 邮箱级转发规则

### FR-FWD-RULE-001 基本规则

每个邮箱可配置：

- 开关；
- 一个或多个目标；
- 是否仅转发特定发件人；
- 发件人匹配模式：全部、白名单、黑名单；
- 是否转发垃圾邮件；
- 是否在 Webmail 保留副本（V1 固定为是）；
- 规则优先级；
- 备注。

### FR-FWD-RULE-002 多目标

Cloudflare 每条 Email Routing 规则本身只对应一个目标，但 Worker 可以针对同一入站邮件逐个调用 `forward()`。每个目标都必须事先验证。

应用级默认限制：

- 每个邮箱最多 3 个目标；
- 每个用户最多 10 个目标；
- 管理员可调整；
- 避免目标数量过多导致 CPU、网络和重复投递风险。

### FR-FWD-RULE-003 防回路

在以下情况下跳过并记录：

- 目标等于当前域名邮箱；
- 目标是系统中另一个会再次转回原地址的邮箱；
- 邮件头包含本系统生成的转发链标记且已超过阈值；
- 同一 `message_id + target_id` 已成功转发；
- 目标已禁用或未验证。

## 5.7 投递日志

统一记录三类事件：

- `inbound`：入站解析与存储；
- `forward`：转发到常用邮箱；
- `outbound`：Webmail 发信。

日志字段包括：

- request ID；
- message ID；
- account ID；
- target/provider；
- 状态；
- 服务商返回 ID；
- 错误代码与脱敏摘要；
- 尝试次数；
- 开始、结束、耗时；
- 创建时间。

普通用户只看自己的日志；管理员可按域名、邮箱、状态和时间查询。

## 5.8 管理台页面

新增菜单：

1. **域名状态**：DNS、Routing、SPF/DKIM/DMARC；
2. **邮箱管理**：创建、批量创建、停用、恢复；
3. **转发目标**：地址、验证状态、共享范围；
4. **转发规则**：按邮箱配置；
5. **发送服务**：选择 provider，展示配额但不回显密钥；
6. **投递日志**：入站、转发、发信；
7. **系统健康**：D1/KV/R2、Workers 日志、配额和版本；
8. **安全与审计**：登录、建号、配置变更和密钥轮换时间。

# 六、核心业务流程

## 6.1 入站处理流程

![入站处理流程](assets/inbound_flow.png){width=72%}

建议把 `mail-worker/src/email/email.js` 拆成明确阶段：

```text
receiveEmailEvent
  -> readRawMessage
  -> validateEnvelope
  -> resolveAccount
  -> rejectUnknownOrDisabled
  -> parseMime
  -> sanitizeContent
  -> persistInboundMessage
  -> resolveForwardRules
  -> executeForwarding
  -> writeDeliveryLogs
```

伪代码：

```javascript
export async function handleInboundEmail(message, env, ctx) {
  const requestId = crypto.randomUUID();
  const raw = await readRaw(message.raw, MAX_INBOUND_BYTES);
  const envelope = normalizeEnvelope(message);

  const account = await accountService.findActiveByEmail(env, envelope.to);
  if (!account) {
    message.setReject('Recipient not found');
    return;
  }

  const dedupeKey = await buildInboundDedupeKey(envelope, raw);
  if (await emailService.existsByDedupeKey(env, dedupeKey)) {
    return;
  }

  const parsed = await PostalMime.parse(raw);
  const safeMail = sanitizeInboundMail(parsed);
  const emailRow = await emailService.persistInbound(env, {
    requestId,
    account,
    envelope,
    parsed: safeMail,
    dedupeKey,
  });

  const rules = await forwardRuleService.listEffectiveRules(env, account.accountId);
  for (const rule of rules) {
    const log = await deliveryLogService.startForward(env, emailRow, rule);
    try {
      await message.forward(rule.targetEmail);
      await deliveryLogService.success(env, log.id);
    } catch (error) {
      await deliveryLogService.fail(env, log.id, normalizeProviderError(error));
    }
  }
}
```

注意：Cloudflare 的 `message.forward()` 依赖当前 EmailEvent 的 `message` 对象，不能假设稍后在普通 HTTP 请求或 Cron 中仍可直接重放。V1 的失败处理以“记录、告警、人工确认”为主。若要自动重试，应保存原始 MIME，并明确使用发送服务重新投递，或引入适合 EmailEvent 的异步设计，不能简单把 `message` 序列化进队列。

## 6.2 未知地址处理

推荐配置：

```text
Catch-all: enabled → Worker
Application unknown recipient policy: reject
```

原因：

- 创建新邮箱无需修改 Cloudflare 路由；
- 避免 200 条路由规则限制；
- 随机地址不会进入数据库；
- 可以在管理台实时启停地址；
- 保留未来增加别名或临时地址的能力。

## 6.3 转发规则计算

有效规则计算顺序：

1. 邮箱是否启用接收；
2. 邮箱转发总开关；
3. 用户和角色是否允许外部转发；
4. 规则是否启用；
5. 目标是否已验证且启用；
6. 发件人是否命中白名单/黑名单；
7. 是否命中防回路；
8. 是否已经成功投递过；
9. 按优先级与目标 ID 稳定排序；
10. 截断到允许的最大目标数。

## 6.4 发信流程

```text
Webmail 请求
  → 身份认证
  → 发件地址归属检查
  → 角色/域名/频率/每日配额检查
  → 保存“待发送”记录
  → Provider Adapter 发送
  → 更新 provider_message_id 与状态
  → 写 outbound delivery_log
```

发信接口必须支持客户端幂等键：

```http
Idempotency-Key: 7eb9d50e-...
```

同一用户、同一幂等键在有效期内只能产生一封外部邮件，防止页面重试导致重复发送。

## 6.5 常用邮箱中的回复体验

系统提供两种模式：

### 模式 A：在 cloud-mail 中回复

优点：

- 不需要额外 SMTP 配置；
- From 一定是域名邮箱；
- 对话、配额和日志都在一个系统；
- 最容易控制权限。

缺点：需要进入管理台操作。

### 模式 B：在 Gmail 中回复

步骤：

1. 入站邮件由 Worker 转发到 Gmail；
2. 在 Gmail“账号和导入”中添加 `sales@example.com`；
3. SMTP 服务器使用 SMTP2GO；
4. 验证发件地址；
5. 选择“回复邮件时使用收到该邮件的地址”。

此模式下，SMTP2GO 的发送不一定自动回写 cloud-mail 发件箱。要统一日志，可以：

- 接受“外部客户端发件不回写”的边界；或
- 配置 SMTP2GO Webhook，把事件写入 `delivery_log`；或
- 让用户密送一个系统归档地址，但需防止循环和重复。

# 七、数据模型设计

## 7.1 设计原则

- 新表使用 UUID 或稳定的文本 ID，避免前端依赖连续自增 ID；
- 所有邮箱统一小写存储，并保留显示名称；
- 删除默认软删除，敏感数据设置明确保留期；
- 唯一约束要考虑软删除语义；
- 状态字段使用有限枚举；
- 所有写操作记录 `created_by`、`updated_by`；
- 错误详情只存脱敏摘要，完整敏感响应不入库。

## 7.2 `forward_target`

| 字段 | 类型 | 说明 |
|---|---|---|
| `target_id` | TEXT PK | UUID |
| `email` | TEXT NOT NULL | 规范化后的目标邮箱 |
| `name` | TEXT | 显示名称 |
| `owner_user_id` | INTEGER | 私有目标所属用户；系统目标可为空 |
| `scope` | TEXT | `private` / `shared` / `system` |
| `verify_status` | TEXT | `pending` / `verified` / `invalid` |
| `enabled` | INTEGER | 0/1 |
| `verified_at` | TEXT | 验证时间 |
| `last_checked_at` | TEXT | 最近检查时间 |
| `note` | TEXT | 备注 |
| `created_by` | INTEGER | 创建者 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `is_del` | INTEGER | 软删除 |

建议唯一索引：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_forward_target_email_active
ON forward_target(lower(email), owner_user_id)
WHERE is_del = 0;
```

## 7.3 `account_forward_rule`

| 字段 | 类型 | 说明 |
|---|---|---|
| `rule_id` | TEXT PK | UUID |
| `account_id` | INTEGER NOT NULL | 关联域名邮箱 |
| `target_id` | TEXT NOT NULL | 关联目标 |
| `enabled` | INTEGER | 0/1 |
| `sender_mode` | TEXT | `all` / `allow` / `deny` |
| `sender_patterns` | TEXT | JSON 数组；精确地址或域名模式 |
| `forward_spam` | INTEGER | 是否转发被标记垃圾邮件 |
| `priority` | INTEGER | 默认 100 |
| `created_by` | INTEGER | 创建者 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `is_del` | INTEGER | 软删除 |

唯一约束：同一邮箱与目标只能有一条有效规则。

## 7.4 `delivery_log`

| 字段 | 类型 | 说明 |
|---|---|---|
| `delivery_id` | TEXT PK | UUID |
| `request_id` | TEXT | 一次处理链路 ID |
| `direction` | TEXT | `inbound` / `forward` / `outbound` |
| `email_id` | INTEGER | 关联邮件 |
| `account_id` | INTEGER | 关联邮箱 |
| `target_id` | TEXT | 转发目标 |
| `provider` | TEXT | `cloudflare-forward` / `resend` / `smtp2go` / `cloudflare-send` |
| `provider_message_id` | TEXT | 服务商 ID |
| `dedupe_key` | TEXT | 去重键 |
| `status` | TEXT | `pending` / `success` / `failed` / `skipped` |
| `error_code` | TEXT | 规范化错误码 |
| `error_summary` | TEXT | 脱敏摘要 |
| `attempt` | INTEGER | 尝试次数 |
| `duration_ms` | INTEGER | 耗时 |
| `created_at` | TEXT | 创建时间 |
| `finished_at` | TEXT | 完成时间 |

唯一索引示例：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_forward_once
ON delivery_log(direction, dedupe_key, target_id)
WHERE direction = 'forward' AND status = 'success';
```

## 7.5 `mail_domain`（可选 V1.1）

| 字段 | 类型 | 说明 |
|---|---|---|
| `domain_id` | TEXT PK | UUID |
| `domain` | TEXT UNIQUE | 域名 |
| `enabled` | INTEGER | 启用状态 |
| `default_provider` | TEXT | 默认发送服务 |
| `routing_status` | TEXT | 路由状态 |
| `dns_status` | TEXT | JSON 或聚合状态 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## 7.6 现有表变更

建议对 `account` 增加：

```sql
ALTER TABLE account ADD COLUMN receive_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE account ADD COLUMN send_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE account ADD COLUMN forward_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account ADD COLUMN outbound_provider TEXT;
ALTER TABLE account ADD COLUMN deleted_at TEXT;
ALTER TABLE account ADD COLUMN deleted_by INTEGER;
```

建议对 `email` 增加：

```sql
ALTER TABLE email ADD COLUMN request_id TEXT;
ALTER TABLE email ADD COLUMN dedupe_key TEXT;
ALTER TABLE email ADD COLUMN raw_r2_key TEXT;
ALTER TABLE email ADD COLUMN size_bytes INTEGER;
ALTER TABLE email ADD COLUMN security_status TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_email_dedupe_key
ON email(dedupe_key) WHERE dedupe_key IS NOT NULL;
```

## 7.7 完整迁移示例

建议新增版本化迁移文件，例如：

```text
mail-worker/migrations/
  0001_baseline.sql
  0002_forwarding.sql
  0003_delivery_log.sql
  0004_account_lifecycle.sql
```

`0002_forwarding.sql` 示例：

```sql
CREATE TABLE IF NOT EXISTS forward_target (
  target_id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  owner_user_id INTEGER,
  scope TEXT NOT NULL DEFAULT 'private',
  verify_status TEXT NOT NULL DEFAULT 'pending',
  enabled INTEGER NOT NULL DEFAULT 1,
  verified_at TEXT,
  last_checked_at TEXT,
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_del INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS account_forward_rule (
  rule_id TEXT PRIMARY KEY NOT NULL,
  account_id INTEGER NOT NULL,
  target_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sender_mode TEXT NOT NULL DEFAULT 'all',
  sender_patterns TEXT,
  forward_spam INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_del INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (account_id) REFERENCES account(account_id),
  FOREIGN KEY (target_id) REFERENCES forward_target(target_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_account_forward_rule_active
ON account_forward_rule(account_id, target_id)
WHERE is_del = 0;

CREATE INDEX IF NOT EXISTS ix_account_forward_rule_account
ON account_forward_rule(account_id, enabled, is_del, priority);
```

## 7.8 迁移执行要求

- 禁止把 `jwt_secret` 直接作为公开 URL 的长期迁移密码；
- 迁移命令应检查当前 schema version；
- 每个迁移只执行一次；
- 先备份 D1，再执行生产迁移；
- 迁移失败必须回滚或停止发布；
- CI 先在独立测试 D1 运行；
- 应用启动不得静默修改生产 schema。

# 八、API 设计

## 8.1 统一约定

- 前缀：`/api`；
- JSON 请求与响应；
- 身份使用现有 JWT，但建议改为 HttpOnly Secure Cookie，或至少避免长期 Token 暴露在 LocalStorage；
- 所有写请求要求 CSRF 防护或严格同源；
- 所有请求生成 `X-Request-Id`；
- 错误响应不返回堆栈和服务商密钥；
- 列表接口必须分页并限制最大页大小；
- ID 使用不可预测值；
- 写接口记录审计日志。

统一响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "..."
}
```

## 8.2 转发目标 API

### 查询

```http
GET /api/forward-target/list?page=1&size=20&status=verified
```

### 创建

```http
POST /api/forward-target/add
Content-Type: application/json

{
  "email": "me@gmail.com",
  "name": "我的常用邮箱",
  "scope": "private",
  "note": "主要收件箱"
}
```

### 更新状态

```http
POST /api/forward-target/check/:targetId
```

第一期可以由管理员人工确认后设置 `verified`，但页面必须提示“还需要在 Cloudflare 中完成验证”。推荐版通过只读 Cloudflare API 查询实际状态，不允许前端直接声明已验证。

### 停用与删除

```http
POST /api/forward-target/disable/:targetId
DELETE /api/forward-target/:targetId
```

删除前检查是否仍被有效规则引用。

## 8.3 邮箱转发规则 API

```http
GET    /api/account/:accountId/forward-rules
PUT    /api/account/:accountId/forward-rules
POST   /api/account/:accountId/forward-test
```

更新示例：

```json
{
  "forwardEnabled": true,
  "rules": [
    {
      "targetId": "target_uuid_1",
      "enabled": true,
      "senderMode": "all",
      "senderPatterns": [],
      "priority": 100
    }
  ]
}
```

服务端校验：

- 当前用户拥有该 account，或有管理员权限；
- 目标属于当前用户或已共享；
- 目标已验证且启用；
- 规则数量未超限；
- 不存在回路；
- 更新采用事务；
- 返回规则最终状态，而不是盲信请求体。

## 8.4 投递日志 API

```http
GET /api/delivery-log/list?direction=forward&status=failed&page=1&size=20
GET /api/delivery-log/:deliveryId
POST /api/delivery-log/:deliveryId/acknowledge
```

V1 不提供“直接重新调用 Cloudflare forward”的按钮，因为原 EmailEvent 已结束。若后续实现基于原始 MIME 的重发，接口命名应为 `replay`，并明确它是一次新的外部发送，不是原始 SMTP 转发。

## 8.5 发送服务 API

```http
GET  /api/provider/status
POST /api/provider/test
PUT  /api/provider/domain/:domain
```

`GET /status` 只返回：

- provider 类型；
- 是否已配置；
- 域名是否验证；
- 最近测试时间；
- 当前可见配额；
- 密钥末 4 位或完全不显示。

不返回 Secret 原文。

## 8.6 邮箱生命周期 API

```http
POST /api/account/add
POST /api/account/batch-add
POST /api/account/:id/disable
POST /api/account/:id/restore
DELETE /api/account/:id
POST /api/account/:id/recreate
```

`recreate` 必须要求管理员选择：

```json
{
  "reuseAddress": true,
  "inheritOldMail": false,
  "purgeOldRules": true
}
```

默认值必须是“不继承旧邮件”。

# 九、后端改造方案

## 9.1 推荐目录

在现有 `mail-worker/src` 下新增：

```text
entity/
  forward-target.js
  account-forward-rule.js
  delivery-log.js

dao/
  forward-target-dao.js
  forward-rule-dao.js
  delivery-log-dao.js

service/
  forward-target-service.js
  forward-rule-service.js
  delivery-log-service.js
  outbound-provider-service.js

provider/
  outbound-provider.js
  resend-provider.js
  smtp2go-provider.js
  cloudflare-provider.js

api/
  forward-target-api.js
  forward-rule-api.js
  delivery-log-api.js
  provider-api.js

security/
  rate-limit.js
  audit.js
  html-sanitizer.js

utils/
  idempotency-utils.js
  provider-error-utils.js
```

## 9.2 入站代码改造

对 `mail-worker/src/email/email.js`：

1. 保留 PostalMime、黑名单、账户和角色检查；
2. 把读取系统设置、解析、存储、转发拆成小函数；
3. 增加 `requestId`、`dedupeKey` 和耗时；
4. 在保存成功后读取邮箱级规则；
5. 逐目标转发，并逐条记录结果；
6. 全局转发作为“系统规则”兼容一段时间；
7. 加入迁移开关：`FORWARD_RULE_ENGINE=v1|legacy`；
8. 日志禁止输出完整邮件正文与完整目标列表；
9. 未知地址默认拒收；
10. 对异常分类，避免一个目标失败阻断其他目标。

兼容策略：

```text
若 account_forward_rule 存在有效规则：使用新规则
否则若 legacy forward_status 开启：使用旧全局规则
否则：不转发
```

上线稳定后再移除旧配置。

## 9.3 发送 Provider Adapter

接口：

```javascript
export class OutboundProvider {
  async send(context, mail) {
    throw new Error('Not implemented');
  }

  async healthCheck(context, domain) {
    throw new Error('Not implemented');
  }
}
```

业务层统一输入：

```javascript
{
  from: { email, name },
  to: [],
  cc: [],
  bcc: [],
  subject,
  text,
  html,
  attachments: [],
  headers: {},
  idempotencyKey
}
```

统一输出：

```javascript
{
  ok: true,
  provider: 'resend',
  providerMessageId: '...',
  accepted: [],
  rejected: [],
  rawStatus: 'accepted'
}
```

### Resend Provider

- 复用现有 SDK；
- Token 由 Worker Secret 读取；
- 多域名时使用 `RESEND_TOKEN_<DOMAIN_KEY>` 或 Secret JSON；
- 保留现有附件与回复头；
- 将服务商错误映射成统一错误码。

### SMTP2GO Provider

推荐使用 HTTP API，而不是在 Worker 中自行维护传统 SMTP 长连接。配置：

```text
SMTP2GO_API_KEY
SMTP2GO_SENDER_DOMAIN
```

能力：

- Webmail 发信；
- 附件；
- 自定义头；
- 返回 message ID；
- 可选 Webhook 同步 delivered/bounce/spam 事件。

Gmail“用其他地址发送”仍使用 SMTP2GO 的 SMTP 凭据；这些凭据不应写进 cloud-mail 前端。

### Cloudflare Provider

- 仅当 `env.email` binding 存在时启用；
- 向任意收件人发信需要 Workers Paid；
- 适合希望减少外部供应商数量的账户；
- 日志以 Email Sending 指标为准，不以 Email Routing 页面中的 dropped 状态判断。

## 9.4 Secret 管理

建议：

```bash
cd mail-worker
pnpm wrangler secret put JWT_SECRET
pnpm wrangler secret put RESEND_API_KEY
pnpm wrangler secret put SMTP2GO_API_KEY
pnpm wrangler secret put CLOUDFLARE_READ_TOKEN
```

`wrangler.toml` 中只保留：

- 域名数组；
- 管理员邮箱；
- 非敏感开关；
- Binding 名称；
- 资源 ID（是否视为敏感可按团队策略处理）。

应用管理台只能更新非敏感业务配置。Secret 轮换由部署流程完成。

## 9.5 SQL 注入修复

当前批量建号路径必须改为 Drizzle 或参数化绑定。示例：

```javascript
const userStmt = c.env.db.prepare(`
  INSERT INTO user
    (email, password, salt, type, os, browser, active_ip,
     create_ip, device, active_time, create_time)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  email, hash, salt, type, os, browser,
  activeIp, activeIp, device, activeTime, activeTime
);

const accountStmt = c.env.db.prepare(`
  INSERT INTO account (email, name, user_id)
  VALUES (?, ?, 0)
`).bind(email, emailUtils.getName(email));
```

还应：

- 删除字符串拼接 SQL；
- 对 `list` 数量设上限；
- 对输入字段做长度限制；
- 对 User-Agent 解析结果做长度限制；
- 公共 Token 改为短时、一次性、范围受限；
- 最好直接取消公网批量建号，改为管理员登录态接口。

## 9.6 权限中间件改造

现有权限由“路由前缀数组 + 权限映射”维护，容易遗漏。推荐把权限声明贴近路由：

```javascript
router.post(
  '/forward-target/add',
  requireAuth(),
  requirePermission('forward-target:add'),
  validateBody(schema),
  handler
);
```

新增权限键：

```text
forward-target:query
forward-target:add
forward-target:set
forward-target:delete
forward-rule:query
forward-rule:set
delivery-log:query
provider:query
provider:test
security:audit
```

必须测试普通用户不能跨 `userId` 或 `accountId` 访问他人资源。

## 9.7 CORS 与 CSRF

生产环境只允许：

```text
https://mail.example.com
```

如果前后端同源，优先完全取消跨域需求。禁止：

```javascript
app.use('*', cors());
```

推荐：

```javascript
cors({
  origin: ['https://mail.example.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
  credentials: true,
  maxAge: 86400
});
```

使用 Cookie 登录时必须配合 SameSite、CSRF Token 和 Origin 检查。

# 十、前端改造方案

## 10.1 页面与路由

建议新增：

```text
mail-vue/src/views/forward/
  TargetList.vue
  RuleList.vue
  RuleEditor.vue
  DeliveryLog.vue

mail-vue/src/views/domain/
  DomainStatus.vue

mail-vue/src/views/provider/
  ProviderStatus.vue

mail-vue/src/request/
  forwardTarget.js
  forwardRule.js
  deliveryLog.js
  provider.js
  domain.js
```

## 10.2 转发目标页面

列表字段：

- 名称；
- 目标邮箱；
- 范围；
- 验证状态；
- 启用状态；
- 使用规则数；
- 最近检查时间；
- 操作。

添加目标弹窗在提交后显示操作指引：

```text
1. 打开 Cloudflare Dashboard
2. 进入 Email → Email Routing → Destination addresses
3. 添加目标邮箱
4. 前往目标邮箱点击验证链接
5. 回到本页面点击“重新检查”
```

## 10.3 邮箱转发规则编辑器

每一行：

- 邮箱地址；
- 转发总开关；
- 目标多选；
- 发件人规则；
- 状态；
- 最近一次转发结果；
- 编辑。

交互限制：

- 未验证目标不可选；
- 目标超过上限即时提示；
- 目标与源地址相同立即拦截；
- 保存前显示规则摘要；
- 敏感操作二次确认；
- 保存成功后重新读取服务端结果。

## 10.4 投递日志页面

筛选项：

- 时间范围；
- 域名；
- 邮箱；
- 方向；
- Provider；
- 状态；
- 错误码。

详情不显示：

- API Key；
- JWT；
- 完整 Cookie；
- 完整外部服务响应；
- 无权限用户的邮件正文。

## 10.5 发送服务页面

页面不提供 Secret 原文输入框作为常规配置方式。显示：

- 当前 Provider；
- 是否配置；
- 域名验证状态；
- 最近健康检查；
- 当前月/日可见用量；
- “如何使用 Wrangler Secret 配置”的命令提示；
- 测试收件地址；
- 测试结果。

## 10.6 邮件 HTML 预览

推荐组件：

```html
<iframe
  sandbox="allow-popups allow-popups-to-escape-sandbox"
  referrerpolicy="no-referrer"
  :srcdoc="sanitizedHtml"
/>
```

不要加 `allow-same-origin` 与 `allow-scripts`。远程图片默认替换为占位符，由用户单次确认加载。

# 十一、安全加固清单

## 11.1 P0：上线阻断

| 项目 | 验收标准 |
|---|---|
| SQL 参数化 | 代码扫描无用户输入拼接 SQL；批量建号测试覆盖引号和恶意 User-Agent |
| CORS | 仅生产管理台 Origin；非法 Origin 不能携带认证访问 |
| Secret | 仓库、D1、前端和日志均无 Secret 原文；使用 Worker Secrets |
| 初始化 | 初始化完成后接口不可从公网重复执行；迁移有版本锁 |
| HTML XSS | 邮件 HTML 在 sandbox 中；危险标签、事件属性和模板字符串注入测试通过 |
| 公开注册 | 默认关闭；管理员才能创建用户与邮箱 |
| 越权 | 用户不能查询、修改、删除他人邮箱、规则、目标和附件 |
| 软删除 | 重建同名邮箱不自动继承旧邮件；有恢复与永久删除流程 |
| 限流 | 登录、发信、批量建号、规则修改均有用户/IP 级限流 |
| 备份 | D1 与 R2 有成功恢复演练记录 |

## 11.2 P1：推荐在正式使用前完成

- 管理员强制 MFA；
- 管理域名使用 Cloudflare Access；
- JWT 有短有效期和撤销机制；
- 会话绑定设备或风险信息；
- CSP、HSTS、X-Content-Type-Options、Referrer-Policy；
- R2 对象私有；
- 管理操作审计；
- 密钥轮换记录；
- 错误日志脱敏；
- 依赖漏洞扫描；
- GitHub Actions 最小权限；
- 生产、测试资源完全分离；
- 上传和下载文件名规范化；
- 邮件地址、主题和正文搜索防止通配符滥用导致高负载。

## 11.3 Cloudflare Access 建议

管理台是个人或小团队内部工具时，最省事的增强是：

```text
mail.example.com
  → Cloudflare Access 登录策略
  → cloud-mail 自身登录
```

双层认证可显著降低公开登录页面的攻击面。注意保留 Email Worker 事件入口与必要 API，不要用 Access 误拦截邮件事件。

## 11.4 内容安全策略

建议响应头：

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self';
  frame-src 'self';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none'
```

邮件 iframe 的内容应使用更严格策略，禁止网络和脚本；远程图片由专门代理或用户确认后加载。

## 11.5 日志与隐私

默认日志：

- 可记录收发域名、状态、大小、耗时和错误码；
- 地址本地部分可部分掩码；
- 不记录完整正文；
- 不记录附件内容；
- 不记录认证 Token；
- 生产日志保留期按需要设置；
- 运维人员与邮件内容访问权限分离。

# 十二、部署实施手册

## 12.1 前置条件

- 域名已接入 Cloudflare DNS；
- Cloudflare 账户可创建 Workers、D1、KV、R2；
- Node.js 与 pnpm；
- Wrangler 已登录；
- Resend 或 SMTP2GO 账号；
- 一个独立的外部恢复邮箱；
- 管理员账号已启用 MFA。

## 12.2 Fork 与分支

```bash
git clone https://github.com/<your-account>/cloud-mail.git
cd cloud-mail
git remote add upstream https://github.com/maillab/cloud-mail.git
git fetch upstream

git checkout -b feature/per-account-forwarding
printf '%s\n' "UPSTREAM_COMMIT=$(git rev-parse upstream/main)" > UPSTREAM_BASE.txt
```

推荐分支：

```text
main                 稳定生产分支
develop              集成分支
feature/*             功能分支
security/*            安全修复
upstream-sync/*       上游同步
```

## 12.3 安装依赖

```bash
corepack enable
pnpm --prefix mail-worker install
pnpm --prefix mail-vue install
```

现有 Worker 包含 `dev`、`test`、`deploy` 脚本；前端使用 Vite 的 `build --mode release`。`wrangler.toml` 的 build 命令会自动构建前端。

## 12.4 创建 Cloudflare 资源

```bash
cd mail-worker

pnpm wrangler d1 create cloud-mail-prod-db
pnpm wrangler kv namespace create cloud-mail-prod-kv
pnpm wrangler r2 bucket create cloud-mail-prod-attachments
```

记录返回的 D1 ID、KV ID 和 R2 名称，写入生产 `wrangler.toml` 的对应 Binding：

```toml
[[d1_databases]]
binding = "db"
database_name = "cloud-mail-prod-db"
database_id = "<D1_DATABASE_ID>"

[[kv_namespaces]]
binding = "kv"
id = "<KV_NAMESPACE_ID>"

[[r2_buckets]]
binding = "r2"
bucket_name = "cloud-mail-prod-attachments"
```

Binding 名 `db`、`kv`、`r2` 不要随意修改，因为现有代码依赖这些名称。

## 12.5 配置非敏感变量

```toml
[vars]
domain = ["example.com"]
admin = "admin@example.com"
analysis_cache = true
orm_log = false
```

不要在 `[vars]` 中提交 `jwt_secret` 或发送服务 API Key。即使上游示例允许，也应在二次开发中改为 Secrets。

## 12.6 配置 Secrets

```bash
pnpm wrangler secret put JWT_SECRET
pnpm wrangler secret put RESEND_API_KEY
# 使用 SMTP2GO 时：
pnpm wrangler secret put SMTP2GO_API_KEY
# 使用只读 Cloudflare 状态检查时：
pnpm wrangler secret put CLOUDFLARE_READ_TOKEN
```

应用代码统一读取大写 Secret；兼容旧配置时可短期读取两者，但日志不得显示值。

## 12.7 数据库迁移

开发环境：

```bash
pnpm wrangler d1 execute cloud-mail-dev-db \
  --local --file=./migrations/0001_baseline.sql
```

生产环境：

```bash
pnpm wrangler d1 execute cloud-mail-prod-db \
  --remote --file=./migrations/0001_baseline.sql

pnpm wrangler d1 execute cloud-mail-prod-db \
  --remote --file=./migrations/0002_forwarding.sql
```

执行前导出备份，并确认目标数据库名称。不要把初始化 URL 当作长期数据库迁移机制。

## 12.8 本地开发

Worker：

```bash
cd mail-worker
pnpm dev
```

前端：

```bash
cd mail-vue
pnpm dev
```

本地 Email Worker 事件不一定与真实 Cloudflare 完全一致。至少准备：

- PostalMime 单元测试；
- 规则引擎单元测试；
- Provider mock；
- D1 本地集成测试；
- 部署到独立测试域名做真实入站测试。

## 12.9 部署

```bash
cd mail-worker
pnpm deploy
```

`wrangler.toml` 已配置静态资源目录和构建命令，部署时会构建前端并绑定到 Worker。

部署后：

1. 给 Worker 绑定 `mail.example.com` 自定义域名；
2. 打开管理台；
3. 运行受保护的迁移/初始化；
4. 创建管理员；
5. 关闭初始化入口；
6. 创建测试邮箱；
7. 配置 Email Routing；
8. 配置发送域名；
9. 完成收发和转发验收。

## 12.10 GitHub Actions

仓库已有 GitHub Action 部署说明，通常需要：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
D1_DATABASE_ID
KV_NAMESPACE_ID
R2_BUCKET_NAME
DOMAIN
ADMIN
```

本项目建议调整：

- `JWT_SECRET` 不作为普通变量注入 `wrangler.toml`；
- API Token 只授予部署所需资源；
- 生产部署使用 GitHub Environment 审批；
- Fork 同步与生产部署分成两个工作流；
- PR 只跑测试和预览，不接触生产 Secret；
- 上游同步后必须先通过安全回归。

# 十三、DNS、Email Routing 与邮件认证

## 13.1 Cloudflare DNS

域名可以在其他注册商购买，但 Nameserver 需要指向 Cloudflare，才能使用本方案的 DNS 与 Email Routing。

切换前：

- 导出现有 DNS；
- 检查网站 A/AAAA/CNAME；
- 检查已有 MX；
- 降低关键记录 TTL；
- 确认没有正在使用的旧邮箱服务。

## 13.2 Email Routing

每个邮箱域名：

1. 打开 Cloudflare Dashboard；
2. 进入 Email → Email Routing；
3. 启用 Routing 并接受 MX 建议；
4. 创建 Catch-all；
5. Action 选择 Send to a Worker；
6. 选择 `cloud-mail-prod`；
7. 保证没有冲突的 Catch-all 或旧 MX。

不要为每个域名邮箱创建一条 Cloudflare 路由。逻辑邮箱由应用 D1 管理。

## 13.3 验证常用邮箱目标

1. 在 Email Routing 中添加 Destination Address；
2. Cloudflare 向目标 Gmail/Outlook 发验证邮件；
3. 点击确认；
4. 状态变为 Verified；
5. 在 cloud-mail 管理台刷新目标状态；
6. 再创建转发规则。

一个 Cloudflare 账户当前最多 200 个已验证 Destination Address。通常你只需要一到几个常用邮箱，因此不是瓶颈。

## 13.4 Resend 发信 DNS

在 Resend 中添加发送域名，并把其提供的 DKIM、SPF/Return-Path 等记录加入 Cloudflare DNS。建议使用子域隔离发信，例如：

```text
mail.example.com 或 send.example.com
```

具体 From 是否允许使用根域地址取决于服务商的域名验证方式。不要自行猜测 DNS 值，以服务商控制台当时给出的记录为准。

## 13.5 SMTP2GO 发信 DNS

在 SMTP2GO 的 Verified Senders 中验证整个域名，添加其要求的 CNAME/TXT。验证域名后：

- cloud-mail 可通过 HTTP API 发信；
- Gmail 可通过 SMTP2GO SMTP “用其他地址发送”；
- 更容易保持 DKIM 和品牌对齐。

## 13.6 SPF

根域通常只能存在一条 SPF TXT：

```text
v=spf1 ... ~all
```

不要分别添加两条 `v=spf1`。如果多个服务要求根域 SPF，必须合并 include 或使用服务商推荐的子域/Return-Path 方案。优先遵循发送服务实际提供的 DNS 指令。

## 13.7 DKIM

- 每个发送服务使用自己的 selector；
- 多个 selector 可以同时存在；
- 不要复用私钥；
- 轮换时旧 selector 保留一段时间；
- 控制台只显示检测结果，不保存 DKIM 私钥。

## 13.8 DMARC

初始观察：

```dns
_dmarc.example.com TXT "v=DMARC1; p=none; rua=mailto:dmarc@example.com; adkim=r; aspf=r"
```

稳定后逐步提升：

```text
p=none → p=quarantine → p=reject
```

在升级策略前，确认所有合法发送来源都通过 SPF 或 DKIM 对齐。DMARC 报告地址本身也应是可接收邮箱，并避免报告形成过量附件占用。

## 13.9 管理台域名

将 `mail.example.com` 绑定到 Worker 自定义域名。建议：

- HTTPS 强制；
- HSTS；
- Cloudflare Access；
- 不与邮件追踪、附件公共域名混用；
- R2 对象不直接公开整个 Bucket。

# 十四、成本与升级条件

## 14.1 低量阶段成本

| 项目 | 免费层/低成本用途 | 主要限制或注意事项 |
|---|---|---|
| Cloudflare Email Routing | 入站不限量 | Email Worker 仍受 Workers CPU/内存限制；入站单封 25 MiB |
| Workers Free | 100,000 请求/日 | 单次 10ms CPU；复杂 MIME/附件处理可能出现 `EXCEEDED_CPU` |
| D1 Free | 约 5GB 存储及每日读写额度 | 邮件正文和索引会持续增长，应设保留期 |
| KV Free | 1GB、每日读写限制 | 仅用于会话和计数，不存邮件正文 |
| R2 Free | 10GB-month、免费出口 | 附件增长是主要长期成本 |
| Resend Free | 3,000 封/月、100 封/日、1 个域名 | 适合单域名低量发信 |
| SMTP2GO Free | 1,000 封/月、200 封/日 | 免费报告保留较短；域名验证后取消小时限制 |
| Workers Paid | 账户最低 5 美元/月 | 更高 CPU；Cloudflare arbitrary outbound 需要 Paid |

价格和配额会变化，生产上线前应重新核对官方页面。

## 14.2 推荐的免费组合

```text
入站：Cloudflare Email Routing
应用：Workers Free
数据：D1 + KV + R2 Free
Webmail 发信：Resend Free
外部常用邮箱：Cloudflare message.forward()
Gmail 域名发件（可选）：SMTP2GO Free
```

除域名续费外，低量情况下可接近零成本。

## 14.3 升级 Workers Paid 的触发条件

满足任一条件就应评估升级：

- Workers 日志出现 `EXCEEDED_CPU`；
- 大附件或复杂 HTML 邮件处理失败；
- 需要 Cloudflare Email Sending 向任意收件人发送；
- 免费请求、KV 写入或 D1 配额经常触顶；
- 需要更长日志、稳定 SLO 或更高并发；
- 邮件业务已重要到不能接受免费层硬限制失败。

## 14.4 升级发送服务的触发条件

- Resend 超过每日 100 或每月 3,000；
- 需要多个发送域名而免费计划只允许一个；
- SMTP2GO 超过每月 1,000；
- 需要更长事件日志、Webhook、团队权限或支持；
- 退信和投诉率需要更专业治理；
- 邮件已用于关键交易通知。

## 14.5 存储控制

建议默认：

- 邮件正文保留 180 天；
- 投递日志保留 90 天；
- 已删除邮件回收站 30 天；
- 附件随邮件生命周期删除；
- 重要邮件由用户手动标记长期保留；
- 每日统计 R2 总量与新增量；
- 不将所有原始 MIME 永久保留，除非确有审计或重试需求。

# 十五、开发迭代与 PR 拆解

## 15.1 Sprint 0：基线与安全（P0）

目标：让上游基线可以安全进入测试环境。

任务：

- 固定 Commit 和建立 Fork 同步策略；
- 修复批量建号 SQL；
- 关闭公开注册/公共批量 API；
- 限制 CORS；
- Secret 迁移；
- 初始化接口治理；
- HTML 隔离；
- 软删除测试与修复；
- 基础安全回归。

建议 PR：

```text
PR-001 security: parameterize public addUser inserts
PR-002 security: restrict cors and protect bootstrap routes
PR-003 security: move runtime credentials to Worker Secrets
PR-004 security: sandbox inbound HTML and fix preview injection
PR-005 fix: define account restore/recreate semantics
```

## 15.2 Sprint 1：数据模型和后端规则

- 添加迁移；
- 新增 Entity/DAO/Service；
- 转发目标 CRUD；
- 邮箱规则 CRUD；
- 权限检查；
- `delivery_log`；
- 入站新规则引擎；
- Legacy 兼容开关；
- 单元和集成测试。

## 15.3 Sprint 2：管理台

- 转发目标页面；
- 邮箱规则页面；
- 投递日志页面；
- 邮箱管理增强；
- 权限菜单；
- i18n；
- 移动端适配；
- 错误与空状态。

## 15.4 Sprint 3：发送服务适配

- 抽象 Provider；
- 迁移现有 Resend；
- SMTP2GO HTTP Provider；
- Cloudflare Provider 回归；
- 幂等键；
- Provider 健康检查；
- 配额与错误映射。

## 15.5 Sprint 4：部署、监控和验收

- dev/staging/prod 配置；
- GitHub Actions；
- DNS 与 Email Routing；
- 备份恢复；
- 端到端测试；
- 压力和大附件测试；
- 运行手册；
- 上线和回滚演练。

AI 邮件监控、批量摘要、零成本护栏与后续 Agents SDK 升级条件，见专项规划：
[`docs/AI_MAIL_AGENT_PLAN.md`](AI_MAIL_AGENT_PLAN.md)。

## 15.6 Definition of Done

每个 PR 至少满足：

- 有测试；
- 无 Secret；
- 有数据库迁移及回滚说明；
- 有权限校验；
- 有错误码；
- 有日志但不泄露内容；
- 更新本说明书或对应 ADR；
- 前端有加载、空、错误状态；
- 通过 lint/build/test，并在 staging 完成真实收发验证。

# 十六、测试方案与验收标准

## 16.1 单元测试

### 规则引擎

- 邮箱无规则；
- 单目标；
- 多目标；
- 未验证目标；
- 停用目标；
- 白名单命中/未命中；
- 黑名单命中；
- 自转发；
- 两邮箱循环；
- 已成功投递去重；
- 规则数超限；
- 普通用户越权。

### 地址与输入

- 大小写；
- Unicode/IDN 策略；
- 引号、反斜杠、控制字符；
- 超长本地部分；
- 恶意 User-Agent；
- 批量列表超限；
- 重复邮箱；
- 软删除冲突。

### Provider

- 成功；
- API Key 无效；
- 域名未验证；
- 每日限额；
- 网络超时；
- 429；
- 5xx；
- 附件过大；
- 重复幂等键；
- 服务商错误脱敏。

## 16.2 集成测试

- D1 迁移从空库执行；
- 从上游基线库升级；
- 新增/删除/恢复邮箱；
- 新增目标与规则；
- EmailEvent mock；
- 附件写入和权限下载；
- Delivery Log 查询；
- 用户角色和管理员权限；
- Secret 缺失时的明确错误；
- Legacy 转发兼容。

## 16.3 安全测试

- SQL 注入 payload；
- XSS：script、onerror、svg、iframe、反引号、`${}`、`</script>`；
- IDOR：替换 accountId、targetId、emailId、attachmentId；
- CORS 非法 Origin；
- CSRF；
- 暴力登录；
- Token 重放；
- 公共初始化路径；
- 文件名路径穿越；
- 超大请求体；
- 日志 Secret 泄露；
- R2 未授权访问。

## 16.4 端到端测试矩阵

| 编号 | 场景 | 预期 |
|---|---|---|
| E2E-01 | 外部 Gmail → `hello@example.com` | Webmail 出现，正文正确 |
| E2E-02 | 带附件邮件 | R2 保存，授权用户可下载 |
| E2E-03 | 未创建地址 | SMTP 侧被拒收，不进入 D1 |
| E2E-04 | 邮箱停用 | 拒收或按产品定义处理 |
| E2E-05 | 单目标转发 | Gmail 收到；日志 success |
| E2E-06 | 两目标转发 | 两个已验证目标都收到 |
| E2E-07 | 一个目标失败 | 另一个仍成功；各自日志独立 |
| E2E-08 | Webmail → Gmail | From 正确；SPF/DKIM/DMARC 结果符合预期 |
| E2E-09 | Webmail 回复 | `In-Reply-To` 与线程正确 |
| E2E-10 | Gmail 经 SMTP2GO 域名发信 | From 为域名地址，投递成功 |
| E2E-11 | HTML 恶意邮件 | 不执行脚本，不读取会话 |
| E2E-12 | 同一事件重复处理 | 只存一份或按明确策略处理 |
| E2E-13 | 软删除后重建同名地址 | 不泄露旧邮件 |
| E2E-14 | 普通用户访问他人规则 | 403 |

## 16.5 性能与限额测试

- 纯文本小邮件；
- 1、5、10、20 MiB 附件；
- 多附件；
- 大量 HTML 节点；
- 3 个转发目标；
- 同时 20 封入站；
- 每日发信接近服务商上限；
- D1 大分页查询；
- R2 下载；
- Workers CPU 日志。

免费层若在真实大附件测试中出现 `EXCEEDED_CPU`，不要通过删除安全检查来“优化”，应升级 Workers 或重构处理流程。

## 16.6 验收标准

上线必须满足：

- 连续 7 天真实收信无未解释丢失；
- 100 封测试邮件入站成功率 99% 以上，失败均有可定位原因；
- 转发成功率与目标邮箱过滤情况可区分；
- Webmail 发信能通过目标邮箱的认证检查；
- P0 安全项全部关闭；
- D1/R2 恢复演练成功；
- staging 到 prod 发布与回滚演练成功；
- 监控能识别 `EXCEEDED_CPU`、5xx、发信限额和存储增长。

# 十七、上线、回滚与运维

## 17.1 上线顺序

1. 生产资源和 Secret 准备；
2. D1 备份；
3. 部署兼容新旧数据结构的代码；
4. 执行迁移；
5. 管理台健康检查；
6. 创建测试邮箱；
7. 只对测试域名或子域启用 Email Routing；
8. 验证收、发、转发；
9. 再切换正式域名；
10. 观察 24–72 小时；
11. 关闭 Legacy 规则；
12. 清理不再使用的旧 Secret 和入口。

## 17.2 回滚原则

- 代码回滚不自动回滚数据；
- 数据迁移尽量向后兼容一个版本；
- 新字段先可空或有默认值；
- 删除列和表至少延后一版；
- Email Routing 可以快速切回临时外部邮箱，但会绕过 Webmail，仅作为灾难恢复；
- 回滚前记录当前 Worker 版本、D1 版本和 DNS 状态。

## 17.3 灾难恢复路由

准备一条未启用的应急方案：

```text
Catch-all → 已验证的应急 Gmail
```

当 Worker 长时间不可用且无法立即修复时，可临时把 Catch-all 从 Worker 切到应急 Gmail。缺点是期间邮件不进入 cloud-mail，因此必须记录切换窗口，并在恢复后人工归档。

## 17.4 监控指标

- 入站总数、成功、拒收、解析失败；
- 每域/每邮箱入站量；
- 转发成功率、失败率、目标失败分布；
- 发信成功、429、5xx、退信；
- Worker CPU、异常、`EXCEEDED_CPU`；
- D1 读写与大小；
- KV 读写；
- R2 总量与每日增长；
- 登录失败、批量建号和规则变更；
- Secret 最近轮换时间；
- DMARC 报告趋势。

## 17.5 告警建议

| 告警 | 阈值示例 |
|---|---|
| Worker 5xx | 5 分钟超过 5 次 |
| 入站解析失败 | 15 分钟超过 3 封 |
| 转发失败率 | 15 分钟超过 10%，且至少 5 封 |
| 发信 429 | 任意出现即通知 |
| `EXCEEDED_CPU` | 任意出现即通知 |
| R2 增长 | 单日超过近 7 日均值 3 倍 |
| 登录失败 | 同 IP 10 分钟超过 10 次 |
| 管理员配置变更 | 实时审计通知 |

## 17.6 备份

至少保留：

- D1 定期导出；
- R2 对象清单和生命周期策略；
- `wrangler.toml` 非敏感配置；
- Secret 名称与轮换记录，但不在普通备份中保存明文；
- 部署 Commit、迁移版本和 DNS 记录导出；
- 恢复步骤文档。

每季度进行一次恢复演练，而不是只确认“有备份文件”。

# 十八、风险清单与决策

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 把项目误当成 IMAP 邮箱 | 客户端无法添加账户 | 在产品页明确 Webmail 定位；需要 IMAP 时选择托管服务 |
| Workers Free CPU 太低 | 大邮件解析失败 | 监控 `EXCEEDED_CPU`；升级 Paid；限制附件与优化解析 |
| 转发目标未验证 | 转发失败 | 创建规则前强校验；管理台显示状态 |
| Gmail 回复暴露个人地址 | 品牌与隐私问题 | Webmail 回复，或 SMTP2GO “Send mail as” |
| Catch-all 引入垃圾邮件 | 存储和 CPU 增长 | 未知地址默认拒收；黑名单、配额和限流 |
| 服务商免费额度变化 | 成本或停发 | Provider Adapter；配额告警；上线前复核 |
| 上游同步覆盖二开 | 功能回归 | Fork、独立模块、上游同步 PR、回归测试 |
| HTML 邮件 XSS | 会话和数据泄露 | sandbox、清洗、CSP、外图默认关闭 |
| 软删除复用泄露旧邮件 | 严重隐私事件 | 明确恢复/重建流程；默认不继承 |
| 公共批量 Token 泄露 | 非法建号和 SQL 风险 | 取消公网接口；短时一次性 Token；管理员登录态 |
| Secret 存 D1/前端 | 账号接管 | Worker Secrets；最小权限；轮换 |
| 转发失败不能原生重试 | 邮件只留在 Webmail | 先存储；告警；可选保存原始 MIME并设计重放 |
| 多域名超出 Resend Free | 不能免费发信 | 单域先上线；升级计划；SMTP2GO/Cloudflare 适配 |

## 18.1 关键架构决策（ADR 摘要）

### ADR-001：使用 Catch-all → Worker

**决定**：不为每个邮箱建立 Cloudflare 路由。

**原因**：可以创建大量逻辑邮箱，统一执行存储、安全与规则。

### ADR-002：V1 不实现 IMAP

**决定**：保持 Webmail + 外部转发。

**原因**：Workers 架构与传统长连接邮件协议不匹配；强行实现会显著增加可靠性、安全和运维成本。

### ADR-003：先存储后转发

**决定**：Webmail 为系统记录源，外部邮箱为通知/操作入口。

**原因**：转发失败时仍有副本，便于审计和排障。

### ADR-004：发信 Provider 解耦

**决定**：Resend 为默认，不把业务层锁定到单一服务。

**原因**：免费额度、域名数、价格和可用性可能变化。

**ADR-005：Cloudflare 管理转发验证。** 应用只读取验证状态，不绕过目标确认，避免系统成为开放转发器。

# 十九、最终推荐配置

## 19.1 你的首选配置

```text
DNS：Cloudflare DNS
管理台：mail.example.com
入站：Email Routing Catch-all → cloud-mail Worker
邮箱：在 cloud-mail 管理台创建
存储：D1 + KV + R2
Webmail 发信：Resend Free
外部转发：Cloudflare message.forward() → 已验证 Gmail
Gmail 域名回复（可选）：SMTP2GO Free
安全：Cloudflare Access + 应用登录 + MFA
未知地址：默认拒收
公开注册：关闭
```

## 19.2 实施优先级

第一优先：

- 安全 P0；
- 跑通单域、单外部目标；
- 管理员创建多个邮箱；
- 收件、附件、发信和全局转发。

第二优先：

- 邮箱级转发目标与规则；
- 日志；
- 前端页面；
- SMTP2GO Adapter；
- DNS 健康检查。

第三优先：

- 原始 MIME、重放、Webhook；
- 更复杂多租户和审计；
- 异步处理与多 Provider 故障切换。

## 19.3 成功后的使用方式

管理员：

1. 登录 `mail.example.com`；
2. 创建 `hello@example.com`、`invoice@example.com` 等；
3. 添加并验证常用 Gmail；
4. 为每个邮箱选择转发目标；
5. 查看所有投递日志和配额。

普通用户：

1. 登录管理台；
2. 查看自己拥有的多个邮箱；
3. 在 Webmail 收发；
4. 设置自己的转发规则；
5. 在 Gmail 收到转发邮件；
6. 需要以域名地址回复时使用 Webmail，或配置 SMTP2GO “Send mail as”。

## 19.4 最终判断

这个仓库很适合你的目标，前提是把它理解为：

> **Cloudflare 上的域名邮箱 Webmail 与控制平面，而不是传统 IMAP 邮件服务器。**

对于“自己域名、很多地址、低成本收发、转发到常用邮箱、网页统一管理”这一组需求，它的基础能力与部署模型高度匹配。最关键的二次开发不是重新造收发邮件，而是补齐**邮箱级转发、统一投递日志、发送服务适配和安全生产化**。

# 二十、交付物清单

二次开发完成后仓库至少包含：

```text
docs/CUSTOM_DOMAIN_MAIL_IMPLEMENTATION.md
migrations/0002_forwarding.sql
migrations/0003_delivery_log.sql
migrations/0004_account_lifecycle.sql
mail-worker/src/provider/*
mail-worker/src/service/forward-*-service.js
mail-worker/src/service/delivery-log-service.js
mail-worker/src/api/forward-*.js
mail-worker/src/api/delivery-log-api.js
mail-vue/src/views/forward/*
mail-vue/src/views/provider/*
test/forward-rule.test.js
test/security-regression.test.js
test/provider-adapter.test.js
RUNBOOK.md
SECURITY.md
UPSTREAM_BASE.txt
```

发布材料：

- 生产 `wrangler.toml` 模板；
- Secret 名称清单；
- DNS 记录检查表；
- D1 迁移与备份记录；
- E2E 验收报告；
- 回滚步骤；
- 当前上游 Commit 和二开版本号。

# 二十一、参考资料

以下链接用于实施时复核；价格、配额和仓库代码会变化，部署前以当时官方页面为准。

1. Cloud Mail 仓库：<https://github.com/maillab/cloud-mail>
2. Cloud Mail 部署说明：<https://github.com/maillab/cloud-mail/blob/main/doc/github-action.md>
3. Cloudflare Workers Pricing：<https://developers.cloudflare.com/workers/platform/pricing/>
4. Cloudflare Email Service Pricing：<https://developers.cloudflare.com/email-service/platform/pricing/>
5. Cloudflare Email Service Limits：<https://developers.cloudflare.com/email-service/platform/limits/>
6. Cloudflare Email Routing Rules and Addresses：<https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/>
7. Resend Pricing：<https://resend.com/pricing>
8. SMTP2GO Pricing：<https://www.smtp2go.com/pricing/>
9. Cloud Mail SQL 注入 Issue #403：<https://github.com/maillab/cloud-mail/issues/403>
10. Cloud Mail HTML/XSS Issue #404：<https://github.com/maillab/cloud-mail/issues/404>
11. Cloud Mail 软删除重建 Issue #433：<https://github.com/maillab/cloud-mail/issues/433>

---

**文档结束。** 实施时请把 `example.com`、资源名称、配额和环境变量替换为你的实际值，并在文档首页记录最终采用的上游 Commit。
