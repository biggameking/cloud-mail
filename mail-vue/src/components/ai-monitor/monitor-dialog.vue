<template>
  <el-dialog :model-value="modelValue" :title="$t(form.monitorId ? 'aiEditMonitor' : 'aiCreateMonitor')" width="560px" @close="$emit('update:modelValue', false)">
    <el-form label-position="top">
      <el-form-item :label="$t('aiMonitorName')"><el-input v-model="form.name" maxlength="100"/></el-form-item>
      <el-form-item><el-switch v-model="form.enabled" :active-text="$t('aiRuleEnabled')"/></el-form-item>
      <el-form-item :label="$t('aiMonitoredMailboxes')">
        <el-select v-model="form.accountIds" multiple filterable style="width: 100%">
          <el-option v-for="account in accounts" :key="account.accountId" :value="account.accountId" :label="`${account.email} · ${account.userEmail}`"/>
        </el-select>
      </el-form-item>
      <div class="form-grid form-grid--three">
        <el-form-item :label="$t('aiScheduleTime')">
          <el-time-select v-model="form.scheduleTime" start="00:00" step="00:30" end="23:30" style="width: 100%"/>
        </el-form-item>
        <el-form-item :label="$t('aiTimezone')">
          <el-select v-model="form.timezone" style="width: 100%">
            <el-option value="Asia/Shanghai" label="Asia/Shanghai"/>
            <el-option value="UTC" label="UTC"/>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('aiOutputLanguage')">
          <el-select v-model="form.language" style="width: 100%">
            <el-option value="zh-CN" :label="$t('aiLanguageZh')"/>
            <el-option value="en-US" :label="$t('aiLanguageEn')"/>
          </el-select>
        </el-form-item>
      </div>
      <div class="form-grid">
        <el-form-item :label="$t('aiMaxEmails')"><el-input-number v-model="form.maxEmailsPerRun" :min="1" :max="200"/></el-form-item>
        <el-form-item :label="$t('aiMaxChars')"><el-input-number v-model="form.maxCharsPerEmail" :min="500" :max="20000" :step="500"/></el-form-item>
      </div>
      <el-form-item><el-switch v-model="form.includeRead" :active-text="$t('aiIncludeRead')"/></el-form-item>
      <el-form-item>
        <el-switch v-model="form.deliveryEnabled" :active-text="$t('aiRuleDeliveryEnabled')"/>
        <p class="field-hint">{{ $t('aiRuleDeliveryHint') }}</p>
      </el-form-item>
      <el-collapse>
        <el-collapse-item name="filters" :title="$t('aiAdvancedFilters')">
          <el-form-item :label="$t('aiSenderAllowlist')"><el-input-tag v-model="form.senderAllowlist" :placeholder="$t('aiFilterPlaceholder')"/></el-form-item>
          <el-form-item :label="$t('aiSenderBlocklist')"><el-input-tag v-model="form.senderBlocklist" :placeholder="$t('aiFilterPlaceholder')"/></el-form-item>
          <el-form-item :label="$t('aiSubjectKeywords')"><el-input-tag v-model="form.subjectKeywords" :placeholder="$t('aiKeywordPlaceholder')"/></el-form-item>
		  <el-form-item :label="$t('aiCategoryFilter')">
			<el-select v-model="form.categoryFilter" multiple clearable style="width: 100%">
			  <el-option v-for="category in categories" :key="category" :value="category" :label="$t(`aiCategory_${category}`)"/>
			</el-select>
		  </el-form-item>
        </el-collapse-item>
      </el-collapse>
      <el-alert v-if="countResult" :title="$t('aiPreviewCountResult', countResult)" type="success" :closable="false" show-icon/>
      <el-alert :title="$t('aiPrivacyNotice')" type="info" :closable="false" show-icon/>
    </el-form>
    <template #footer>
      <el-button v-if="form.monitorId" :loading="counting" @click="loadPreviewCount">{{ $t('aiPreviewCount') }}</el-button>
      <el-button @click="$emit('update:modelValue', false)">{{ $t('cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="submit">{{ $t('save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import {reactive, ref, watch} from 'vue';
import {ElMessage} from 'element-plus';
import {useI18n} from 'vue-i18n';
import {aiMonitorPreviewCount} from '@/request/ai-monitor';

const props = defineProps({modelValue: Boolean, monitor: Object, accounts: {type: Array, default: () => []}, loading: Boolean, initialAccountId: Number})
const emit = defineEmits(['update:modelValue', 'save'])
const {t} = useI18n()
const categories = ['action_required', 'deadline', 'notification', 'finance', 'account_security', 'newsletter', 'other']
const form = reactive({monitorId: 0, name: '', enabled: false, accountIds: [], scheduleTime: '08:00', timezone: 'Asia/Shanghai', language: 'zh-CN', deliveryEnabled: false, includeRead: true, maxEmailsPerRun: 50, maxCharsPerEmail: 6000, senderAllowlist: [], senderBlocklist: [], subjectKeywords: [], categoryFilter: []})
const counting = ref(false)
const countResult = ref(null)

watch(() => [props.modelValue, props.monitor, props.initialAccountId], () => {
  if (!props.modelValue) return
  countResult.value = null
  Object.assign(form, {
    monitorId: props.monitor?.monitorId || 0,
    name: props.monitor?.name || '',
    enabled: props.monitor?.enabled === true,
    accountIds: props.monitor?.accountIds ? [...props.monitor.accountIds] : (props.initialAccountId ? [props.initialAccountId] : []),
    scheduleTime: props.monitor?.scheduleTime || '08:00',
    timezone: props.monitor?.timezone || 'Asia/Shanghai',
    language: props.monitor?.language || 'zh-CN',
    deliveryEnabled: props.monitor?.deliveryEnabled === true,
    includeRead: props.monitor?.includeRead !== false,
    maxEmailsPerRun: props.monitor?.maxEmailsPerRun || 50,
    maxCharsPerEmail: props.monitor?.maxCharsPerEmail || 6000,
    senderAllowlist: [...(props.monitor?.senderAllowlist || [])],
    senderBlocklist: [...(props.monitor?.senderBlocklist || [])],
    subjectKeywords: [...(props.monitor?.subjectKeywords || [])],
    categoryFilter: [...(props.monitor?.categoryFilter || [])]
  })
}, {immediate: true})

async function loadPreviewCount() {
  counting.value = true
  try { countResult.value = await aiMonitorPreviewCount(form.monitorId) }
  finally { counting.value = false }
}

function submit() {
  if (!form.name.trim() || !form.accountIds.length) {
    ElMessage({message: t('aiMonitorValidation'), type: 'warning', plain: true})
    return
  }
  emit('save', {...form, name: form.name.trim()})
}
</script>

<style scoped>
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid--three { grid-template-columns: repeat(3, 1fr); }
.field-hint { flex-basis: 100%; margin: 5px 0 0; color: var(--secondary-text-color); font-size: 12px; line-height: 1.5; }
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
:deep(.el-collapse) { margin-bottom: 14px; border: 0; }
:deep(.el-dialog) { max-width: calc(100vw - 28px); }
</style>
