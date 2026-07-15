# AI 邮件摘要运行手册

## Phase 0 状态

AI 邮件监控基础设施已加入，但生产默认关闭。`AI_MONITOR_ENABLED` 只有精确等于字符串 `true` 时才会启用；默认配置为 `false`。关闭状态下调度器不会查询 D1，也不会调用 Workers AI，因此不会产生推理成本。

Workers AI 通过 Wrangler 的 `ai` binding 使用，不需要也不允许配置第三方 API Key。附件、外部 Provider、自动回复、删除和转发能力均不提供给模型。

## 安全部署

1. 保持 `AI_MONITOR_ENABLED = "false"`。
2. 运行 `pnpm exec vitest run`。
3. 运行 `pnpm exec wrangler deploy --dry-run`，确认输出包含 `env.ai (AI)`。
4. 部署 Worker；通过现有初始化接口以管理员身份执行幂等迁移。
5. 复验收信、查看、转发和发信路径。

新增表均使用 `CREATE TABLE/INDEX IF NOT EXISTS`，旧 Worker 不引用这些表；回滚 Worker 不需要删除数据表。

## 成本护栏默认值

- 每日模型调用最多 4 次；
- 每日估算输入最多 500,000 tokens；
- 每日估算输出最多 20,000 tokens；
- 每日估算 Neurons 达到 7,000 前熔断；
- 附件读取和外部 Provider 始终关闭。

这些上限是硬限制，不是目标用量。正式启用前必须再次核对 Cloudflare 官方免费额度和模型定价。

## 紧急停止与回滚

把 `AI_MONITOR_ENABLED` 改回 `false` 并重新部署即可停止所有新 AI 调度。AI 失败不会阻塞正常邮件收取。需要代码回滚时部署上一 Worker Version；新增 D1 表会保留但不会被旧版本访问。
