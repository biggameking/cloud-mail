<template>
  <section class="budget-card" v-loading="loading">
    <div class="budget-heading">
      <div>
        <div class="eyebrow">{{ $t('aiZeroCostGuard') }}</div>
        <h3>{{ $t('aiBudgetToday') }}</h3>
      </div>
      <el-tag :type="usage?.enabled ? 'success' : 'info'">{{ $t(usage?.enabled ? 'enabled' : 'disabled') }}</el-tag>
    </div>
    <div class="budget-grid" v-if="usage">
      <div><strong>{{ usage.calls }} / {{ usage.limits.maxDailyCalls }}</strong><span>{{ $t('aiCalls') }}</span></div>
      <div><strong>{{ format(usage.inputTokens) }} / {{ format(usage.limits.maxDailyInputTokens) }}</strong><span>{{ $t('aiInputTokens') }}</span></div>
      <div><strong>{{ format(usage.estimatedNeurons) }} / {{ format(usage.limits.maxDailyEstimatedNeurons) }}</strong><span>{{ $t('aiEstimatedNeurons') }}</span></div>
    </div>
    <el-progress v-if="usage" :percentage="neuronPercent" :status="neuronPercent >= 90 ? 'exception' : undefined"/>
  </section>
</template>

<script setup>
import {computed} from 'vue';
const props = defineProps({usage: Object, loading: Boolean})
const format = value => new Intl.NumberFormat().format(value || 0)
const neuronPercent = computed(() => Math.min(100, Math.round((props.usage?.estimatedNeurons || 0) * 100 / (props.usage?.limits?.maxDailyEstimatedNeurons || 1))))
</script>

<style scoped>
.budget-card { padding: 20px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }
.budget-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
.budget-heading h3 { margin: 3px 0 0; font-size: 18px; }
.eyebrow { color: var(--el-color-primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.budget-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.budget-grid div { min-width: 0; }
.budget-grid strong, .budget-grid span { display: block; }
.budget-grid strong { font-size: 16px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.budget-grid span { margin-top: 4px; color: var(--secondary-text-color); font-size: 12px; }
@media (max-width: 767px) { .budget-grid { grid-template-columns: 1fr; } }
</style>
