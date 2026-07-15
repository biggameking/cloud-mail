# AI 邮件摘要运行手册

## Phase 0 状态

AI 邮件监控基础设施已加入，但生产默认关闭。`AI_MONITOR_ENABLED` 只有精确等于字符串 `true` 时才会启用；默认配置为 `false`。关闭状态下调度器不会查询 D1，也不会调用 Workers AI，因此不会产生推理成本。

Workers AI 通过 Wrangler 的 `ai` binding 使用，不需要也不允许配置第三方 API Key。附件、外部 Provider、自动回复、删除和转发能力均不提供给模型。

## 安全部署

1. 保持 `AI_MONITOR_ENABLED = "false"`。
2. 运行 `pnpm exec vitest run`。
3. 运行 `pnpm exec wrangler deploy --dry-run`，确认输出包含 `env.ai (AI)`。
4. 部署 Worker；执行 `pnpm exec wrangler d1 migrations apply cloudmail-echoec-db --remote`。AI 专用迁移不得调用会修改现有设置的全量初始化接口。
5. 复验收信、查看、转发和发信路径。

新增表均使用 `CREATE TABLE/INDEX IF NOT EXISTS`，旧 Worker 不引用这些表；回滚 Worker 不需要删除数据表。

## 成本护栏默认值

- 每日模型调用最多 4 次；
- 每日估算输入最多 500,000 tokens；
- 每日估算输出最多 20,000 tokens；
- 每日估算 Neurons 达到 7,000 前熔断；
- 附件读取和外部 Provider 始终关闭。

这些上限是硬限制，不是目标用量。正式启用前必须再次核对 Cloudflare 官方免费额度和模型定价。

首轮 7 天生产观察进一步收紧为每天最多 2 次调用、5,000 Neurons；观察结束且证据通过前不得提高。输入与输出上限保持 500,000/20,000 tokens。

## 紧急停止与回滚

把 `AI_MONITOR_ENABLED` 改回 `false` 并重新部署即可停止所有新 AI 调度。AI 失败不会阻塞正常邮件收取。需要代码回滚时部署上一 Worker Version；新增 D1 表会保留但不会被旧版本访问。

## Phase 2 自动摘要与投递

- Cron 每 30 分钟检查一次到期规则；每条规则可独立选择半小时粒度的每日时间、`Asia/Shanghai`/`UTC` 时区以及中文/英文输出。
- `(monitor_id, period_start, period_end)` 唯一约束会在查询邮件和调用模型前占用运行窗口；重复 Cron 不会重复推理。
- 预算通过 D1 条件 UPSERT 原子预占，默认每天最多 4 次调用，并同时限制输入、输出和估算 Neurons。
- 只有结构化输出校验和摘要落库全部成功后才推进 `last_processed_email_id`。
- 模型超时/5xx 或结构化输出校验失败时最多重试 1 次；第二次调用必须先再次通过 D1 原子预算预占。4xx、配额不足或预算预占失败不重试，原始模型响应不写日志。
- 摘要投递使用固定的 `send_email.destination_address`；API 请求不能指定目标地址。
- 自动投递必须同时满足环境许可、数据库总开关、全局投递开关和规则级“自动投递”四层条件。规则关闭或取消自动投递后，历史待重试摘要也不会被后台再次发送；管理员仍可显式发送单份摘要。
- 发送失败只更新 `delivery_status` 并最多重试 3 次，不会重新调用模型。
- HTML 与纯文本摘要中的每个来源链接只指向 `https://cloudmail.echoec.com/ai-digest`，携带摘要 ID 和源邮件 ID；登录并完成实时权限检查后在当前 Webmail 打开源邮件，不包含外部追踪图片。

正式启用前使用 `wrangler secret put AI_DIGEST_DESTINATION_SECRET` 配置唯一目标，并确认该地址已在 Cloudflare Email Routing 中验证。`send_email` binding 不在 Git 中记录地址，API 请求也不能覆盖 Secret。Cloudflare 官方说明：已验证目标地址可在包括 Free 在内的计划上通过 Workers binding 免费发送。

启用步骤：

1. 先保持 `AI_MONITOR_ENABLED = "false"` 部署并执行数据库迁移。
2. 在管理台创建一条只包含测试邮箱的规则，保持规则关闭。
3. 把 AI 总开关改为 `true` 并部署。
4. 先执行一次“安全预览”，核对来源映射和当日预算。
5. 设置规则的时间、时区、输出语言和是否自动投递，再启用规则；系统会按下一次所选本地时间运行。
6. 如需紧急停止，先关闭总开关；无需删除摘要或监控规则。

## Phase 3 长期运行

- 监控规则支持发件人白名单/黑名单、主题关键词和固定类别筛选；类别值不在允许列表时 API 会拒绝保存。
- “预览待处理数量”只返回数量、过滤数和积压数，不读取附件、不调用模型，也不返回主题或正文。
- 删除监控规则采用软删除：立即停止调度、清除邮箱映射，但保留历史摘要和运行证据；摘要必须单独确认后才能删除。
- 查看历史摘要来源时实时复核源邮件、邮箱和所属用户均未删除且处于启用状态。
- 邮件进入模型前会裁剪常见回复引用、签名与链接，并继续执行凭据、验证码和支付卡号脱敏；附件内容始终不进入模型。
- 每次最多扫描 1,000 封候选邮件、推理最多 200 封。达到单次上限时摘要标记为“部分完成”，游标只推进到已处理邮件，下一批继续。
- 普通摘要默认 30 天后清理；管理员标记“永久保留”的摘要不清理。运行元数据保留 90 天，清理不会删除源邮件。
- 管理台显示积压、耗时、预算 50%/70%、连续失败、24 小时无成功运行和投递重试耗尽告警。
- 摘要消息流支持按监控规则、邮箱、UTC 日历日期和重要程度组合筛选；筛选只查询摘要及来源关系，不读取源邮件正文，也不会调用模型。卡片展示时间窗口、邮件数、重要数和待办数，详情展示生成时间、模型与 Prompt 版本。
- Prompt 版本随每次运行保存；固定安全评测集覆盖 Prompt 注入、长回复链、链接和凭据脱敏。

## 生产备份与恢复演练

发布前在 `mail-worker` 目录执行只读导出，并把生成文件存入受限的离线位置；不要提交到 Git：

```powershell
pnpm exec wrangler d1 export cloudmail-echoec-db --remote --output .backup/cloudmail-echoec-db-YYYYMMDD.sql
```

每次备份应记录文件大小、SHA-256、Worker Version ID 和执行时间，不记录邮件正文或 Secret 到工单和日志。恢复演练必须使用临时 D1，禁止直接覆盖生产库：

1. 创建临时 D1，例如 `cloudmail-echoec-restore-drill`；
2. 对临时库执行 `wrangler d1 execute <临时库名> --remote --file <备份文件>`；
3. 用只读 SQL 核对 `account`、`email`、`ai_monitor`、`ai_digest`、`ai_digest_source` 的行数和外键映射；
4. 将测试 Worker 临时绑定到恢复库，验证普通用户不能访问 AI 管理 API、管理员能查看摘要且源邮件映射有效；
5. 验证完成后删除临时 Worker 和临时 D1，保留演练记录，不保留额外邮件副本。

如果生产恢复确有必要，先关闭环境总开关和数据库总开关，停止写入并再次备份现状；创建新 D1 完成导入及验收后，通过新 Worker Version 切换 binding。不要在原生产 D1 上直接执行破坏性导入。

## 发布后验收记录

连续 7 天每天记录：成功/部分/失败/跳过次数、重复窗口数、模型调用数、估算 Neurons、投递状态、积压峰值和正常收信抽检结果。首轮验收期内保持每日最多 2 次调用和 5,000 Neurons 熔断；出现重复摘要、越权、敏感数据泄露或正常收信回归时立即关闭数据库总开关，再关闭环境总开关并回滚上一 Worker Version。
