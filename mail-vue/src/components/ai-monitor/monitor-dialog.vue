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
      <div class="form-grid">
        <el-form-item :label="$t('aiMaxEmails')"><el-input-number v-model="form.maxEmailsPerRun" :min="1" :max="200"/></el-form-item>
        <el-form-item :label="$t('aiMaxChars')"><el-input-number v-model="form.maxCharsPerEmail" :min="500" :max="20000" :step="500"/></el-form-item>
      </div>
      <el-form-item><el-switch v-model="form.includeRead" :active-text="$t('aiIncludeRead')"/></el-form-item>
      <el-alert :title="$t('aiPrivacyNotice')" type="info" :closable="false" show-icon/>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">{{ $t('cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="submit">{{ $t('save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import {reactive, watch} from 'vue';
import {ElMessage} from 'element-plus';
import {useI18n} from 'vue-i18n';

const props = defineProps({modelValue: Boolean, monitor: Object, accounts: {type: Array, default: () => []}, loading: Boolean, initialAccountId: Number})
const emit = defineEmits(['update:modelValue', 'save'])
const {t} = useI18n()
const form = reactive({monitorId: 0, name: '', enabled: false, accountIds: [], includeRead: true, maxEmailsPerRun: 50, maxCharsPerEmail: 6000})

watch(() => [props.modelValue, props.monitor, props.initialAccountId], () => {
  if (!props.modelValue) return
  Object.assign(form, {
    monitorId: props.monitor?.monitorId || 0,
    name: props.monitor?.name || '',
    enabled: props.monitor?.enabled === true,
    accountIds: props.monitor?.accountIds ? [...props.monitor.accountIds] : (props.initialAccountId ? [props.initialAccountId] : []),
    includeRead: props.monitor?.includeRead !== false,
    maxEmailsPerRun: props.monitor?.maxEmailsPerRun || 50,
    maxCharsPerEmail: props.monitor?.maxCharsPerEmail || 6000
  })
}, {immediate: true})

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
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
</style>
