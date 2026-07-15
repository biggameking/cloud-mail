<template>
  <section v-if="metrics" class="ops-card">
    <div class="ops-heading">
      <div><span class="eyebrow">{{ $t('aiOperations') }}</span><h2>{{ $t('aiOperations24h') }}</h2></div>
      <span class="r2-note">{{ $t('aiR2NotUsed') }}</span>
    </div>
    <div class="ops-grid">
      <div><small>{{ $t('aiDueMonitors') }}</small><strong>{{ metrics.dueMonitors }}</strong></div>
      <div><small>{{ $t('aiRunSummary') }}</small><strong>{{ runSummary }}</strong></div>
      <div><small>{{ $t('aiEmailsProcessed') }}</small><strong>{{ metrics.runs.email_count || 0 }}</strong></div>
      <div><small>{{ $t('aiFilteredEmails') }}</small><strong>{{ metrics.runs.filtered_count || 0 }}</strong></div>
      <div><small>{{ $t('aiValidationFailures') }}</small><strong>{{ metrics.runs.validation_failures || 0 }}</strong></div>
      <div><small>{{ $t('aiProviderRetries') }}</small><strong>{{ metrics.runs.provider_retries || 0 }}</strong></div>
      <div><small>{{ $t('aiDeliveryRate') }}</small><strong>{{ deliveryRate }}</strong></div>
      <div><small>{{ $t('aiStorageEstimate') }}</small><strong>{{ storageLabel }}</strong></div>
    </div>
  </section>
</template>

<script setup>
import {computed} from 'vue';

const props = defineProps({metrics: {type: Object, default: null}})
const runSummary = computed(() => `${props.metrics?.runs?.succeeded || 0}/${props.metrics?.runs?.partial || 0}/${props.metrics?.runs?.failed || 0}/${props.metrics?.runs?.skipped || 0}`)
const deliveryRate = computed(() => {
  const total = props.metrics?.delivery?.total || 0
  return total ? `${Math.round((props.metrics.delivery.sent || 0) / total * 100)}%` : '—'
})
const storageLabel = computed(() => `${Math.ceil((props.metrics?.storage?.bytes || 0) / 1024)} KiB`)
</script>

<style scoped>
.ops-card { max-width: 1180px; margin: 14px auto 0; padding: 18px 20px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }
.ops-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ops-heading h2 { margin: 4px 0 0; font-size: 18px; }
.eyebrow { color: var(--el-color-primary); font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
.r2-note { color: var(--secondary-text-color); font-size: 12px; }
.ops-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.ops-grid div { padding: 12px; border-radius: 9px; background: var(--el-fill-color-light); }
.ops-grid small, .ops-grid strong { display: block; }
.ops-grid small { color: var(--secondary-text-color); }
.ops-grid strong { margin-top: 6px; font-size: 18px; }
@media (max-width: 767px) { .ops-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ops-heading { display: block; } .r2-note { display: block; margin-top: 6px; } }
</style>
