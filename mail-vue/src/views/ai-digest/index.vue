<template>
  <main class="ai-page">
    <header class="page-header">
      <div>
        <span class="eyebrow">{{ $t('aiPrivateAssistant') }}</span>
        <h1>{{ $t('aiDigest') }}</h1>
        <p>{{ $t('aiDigestDescription') }}</p>
      </div>
      <el-button type="primary" @click="openCreate"><Icon icon="ion:add-outline"/>{{ $t('aiCreateMonitor') }}</el-button>
    </header>

    <BudgetStatus :usage="usage" :loading="loadingUsage"/>

    <section class="system-card">
      <div>
        <span class="eyebrow">{{ $t('aiEmergencyControls') }}</span>
        <h2>{{ $t('aiSystemControl') }}</h2>
        <p>{{ $t('aiSystemControlDesc') }}</p>
      </div>
      <div class="system-switches" v-loading="savingSystem">
        <el-switch v-model="system.enabled" :disabled="!system.environmentEnabled" :active-text="$t('aiMasterSwitch')" @change="updateSystem"/>
        <el-switch v-model="system.deliveryEnabled" :disabled="!system.enabled" :active-text="$t('aiDeliverySwitch')" @change="updateSystem"/>
      </div>
    </section>
    <div class="alerts" v-if="alerts.length">
      <el-alert v-for="alert in alerts" :key="alert" :title="$t(alert)" type="warning" :closable="false" show-icon/>
    </div>

    <section class="section-block">
      <div class="section-heading"><div><h2>{{ $t('aiMonitoringRules') }}</h2><p>{{ $t('aiMonitoringRulesDesc') }}</p></div></div>
      <el-empty v-if="!loading && !monitors.length" :description="$t('aiNoMonitors')"/>
      <div class="monitor-grid" v-else v-loading="loading">
        <article class="monitor-card" v-for="monitor in monitors" :key="monitor.monitorId">
          <div class="monitor-top">
            <div><h3>{{ monitor.name }}</h3><p>{{ accountLabel(monitor.accountIds) }}</p></div>
            <el-tag :type="monitor.enabled ? 'success' : 'info'">{{ $t(monitor.enabled ? 'enabled' : 'disabled') }}</el-tag>
          </div>
          <div class="monitor-meta">
            <span><Icon icon="solar:letter-linear"/>{{ $t('aiEmailLimit', {count: monitor.maxEmailsPerRun}) }}</span>
            <span><Icon icon="solar:clock-circle-linear"/>{{ monitor.scheduleTime }} · {{ monitor.timezone }}</span>
            <span><Icon icon="solar:letter-opened-linear"/>{{ $t(monitor.deliveryEnabled ? 'aiRuleDeliveryOn' : 'aiRuleDeliveryOff') }}</span>
            <span><Icon icon="solar:shield-check-linear"/>{{ $t('aiAttachmentsExcluded') }}</span>
          </div>
          <div class="monitor-actions">
			<el-button :loading="previewingId === monitor.monitorId" :disabled="!system.enabled" type="primary" plain @click="preview(monitor)">{{ $t('aiSafePreview') }}</el-button>
            <el-button @click="openEdit(monitor)">{{ $t('settings') }}</el-button>
            <el-button type="danger" text @click="removeMonitor(monitor)">{{ $t('delete') }}</el-button>
          </div>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading"><div><h2>{{ $t('aiRunHistory') }}</h2><p>{{ $t('aiRunHistoryDesc') }}</p></div></div>
      <el-table :data="runs" size="small" empty-text="—" class="run-table">
        <el-table-column prop="monitorName" :label="$t('aiMonitorName')" min-width="150"/>
        <el-table-column :label="$t('tabStatus')" width="120"><template #default="scope"><el-tag size="small" :type="runStatusType(scope.row.status)">{{ $t(`aiRun_${scope.row.status}`) }}</el-tag></template></el-table-column>
        <el-table-column prop="emailCount" :label="$t('aiEmailsProcessed')" width="100"/>
        <el-table-column prop="backlogCount" :label="$t('aiBacklog')" width="90"/>
        <el-table-column prop="estimatedInputTokens" :label="$t('aiInputTokens')" width="130"/>
		<el-table-column prop="promptVersion" :label="$t('aiPromptVersion')" width="130"/>
        <el-table-column prop="durationMs" :label="$t('aiDuration')" width="110"><template #default="scope">{{ scope.row.durationMs == null ? '—' : `${scope.row.durationMs} ms` }}</template></el-table-column>
        <el-table-column :label="$t('date')" min-width="170"><template #default="scope">{{ formatTime(scope.row.startedAt) }}</template></el-table-column>
      </el-table>
    </section>

    <section class="section-block">
      <div class="section-heading"><div><h2>{{ $t('aiDigestFeed') }}</h2><p>{{ $t('aiDigestFeedDesc') }}</p></div></div>
      <div class="digest-filters">
        <el-select v-model="digestFilters.monitorId" clearable :placeholder="$t('aiFilterByMonitor')">
          <el-option v-for="monitor in monitors" :key="monitor.monitorId" :label="monitor.name" :value="monitor.monitorId"/>
        </el-select>
        <el-select v-model="digestFilters.accountId" clearable filterable :placeholder="$t('aiFilterByMailbox')">
          <el-option v-for="account in accounts" :key="account.accountId" :label="account.email" :value="account.accountId"/>
        </el-select>
        <el-date-picker v-model="digestFilters.dateRange" type="daterange" value-format="YYYY-MM-DD"
                        :start-placeholder="$t('aiDateFrom')" :end-placeholder="$t('aiDateTo')"/>
        <el-select v-model="digestFilters.priority" clearable :placeholder="$t('aiFilterByPriority')">
          <el-option v-for="priority in priorities" :key="priority" :label="$t(`aiPriority_${priority}`)" :value="priority"/>
        </el-select>
        <div class="filter-actions">
          <el-button type="primary" :loading="loadingDigests" @click="loadDigests">{{ $t('aiApplyFilters') }}</el-button>
          <el-button @click="resetDigestFilters">{{ $t('reset') }}</el-button>
        </div>
      </div>
      <el-empty v-if="!digests.length" :description="$t('aiNoDigests')"/>
      <div class="digest-list" v-else>
        <button v-for="digest in digests" :key="digest.digestId" class="digest-row" type="button" @click="openDigest(digest.digestId)">
          <span class="digest-mark"><Icon icon="hugeicons:ai-magic" width="20"/></span>
          <span class="digest-copy"><strong>{{ digest.title }}</strong><small>{{ digest.monitorName }} · {{ formatDigestWindow(digest) }}</small><span>{{ digest.overview }}</span></span>
          <span class="digest-stats">
            <el-tag size="small" :type="deliveryType(digest.deliveryStatus)">{{ $t(`aiDelivery_${digest.deliveryStatus}`) }}</el-tag>
            <el-tag size="small" type="info">{{ $t('aiEmailCount', {count: digest.emailCount || 0}) }}</el-tag>
            <el-tag :type="digest.importantCount ? 'danger' : 'info'">{{ $t('aiImportantCount', {count: digest.importantCount || 0}) }}</el-tag>
            <el-tag :type="digest.actionCount ? 'warning' : 'info'">{{ $t('aiActionCount', {count: digest.actionCount || 0}) }}</el-tag>
            <Icon icon="ep:arrow-right"/>
          </span>
        </button>
      </div>
    </section>

    <el-drawer v-model="detailOpen" :title="activeDigest?.title" size="min(720px, 100%)">
      <div v-if="activeDigest" class="digest-detail">
        <div class="detail-actions">
          <el-button v-if="activeDigest.deliveryStatus !== 'sent'" size="small" type="primary" :disabled="!system.deliveryEnabled" :loading="delivering" @click="deliverDigest">{{ $t('aiDeliverDigest') }}</el-button>
          <el-button size="small" @click="toggleRetained">{{ $t(activeDigest.retained ? 'aiUnpinDigest' : 'aiRetainDigest') }}</el-button>
          <el-button size="small" type="danger" plain @click="deleteDigest">{{ $t('delete') }}</el-button>
        </div>
        <el-alert v-if="activeDigest.backlogCount" :title="$t('aiPartialDigest', {count: activeDigest.backlogCount})" type="warning" :closable="false" show-icon/>
        <div class="digest-detail-meta">
          <span>{{ $t('aiGeneratedAt') }}: {{ formatTime(activeDigest.createdAt) }}</span>
          <span>{{ $t('aiModel') }}: {{ activeDigest.model }}</span>
          <span>{{ $t('aiPromptVersion') }}: {{ activeDigest.promptVersion }}</span>
        </div>
        <p class="overview">{{ activeDigest.overview }}</p>
        <article v-for="item in activeDigest.items" :key="item.emailId" class="source-card">
          <div class="source-head"><el-tag :type="priorityType(item.priority)">{{ $t(`aiPriority_${item.priority}`) }}</el-tag><span>{{ $t(`aiCategory_${item.category}`) }}</span></div>
          <h3>{{ item.subject || $t('noSubject') }}</h3>
          <p>{{ item.summary }}</p>
          <ul v-if="item.actions.length"><li v-for="action in item.actions" :key="action.text">{{ action.text }}</li></ul>
          <button class="source-link" type="button" @click="openSource(item.emailId)">{{ $t('aiOpenSource') }} <Icon icon="ep:arrow-right"/></button>
        </article>
      </div>
    </el-drawer>

    <MonitorDialog v-model="dialogOpen" :monitor="editingMonitor" :accounts="accounts" :loading="saving" :initial-account-id="initialAccountId" @save="saveMonitor"/>
  </main>
</template>

<script setup>
import {computed, onMounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useI18n} from 'vue-i18n';
import {ElMessage, ElMessageBox} from 'element-plus';
import {Icon} from '@iconify/vue';
import BudgetStatus from '@/components/ai-monitor/budget-status.vue';
import MonitorDialog from '@/components/ai-monitor/monitor-dialog.vue';
import {aiMonitorAccounts, aiMonitorCreate, aiMonitorDelete, aiMonitorList, aiMonitorUpdate, aiSystemState, aiSystemUpdate} from '@/request/ai-monitor';
import {aiDigestDelete, aiDigestDeliver, aiDigestDetail, aiDigestList, aiDigestPreview, aiDigestSetRetained, aiDigestSource, aiRunList, aiUsageToday} from '@/request/ai-digest';
import {useEmailStore} from '@/store/email';

defineOptions({name: 'ai-digest'})
const {t} = useI18n()
const route = useRoute()
const router = useRouter()
const emailStore = useEmailStore()
const monitors = ref([])
const accounts = ref([])
const digests = ref([])
const loadingDigests = ref(false)
const priorities = ['high', 'medium', 'low']
const digestFilters = ref({monitorId: null, accountId: null, dateRange: null, priority: null})
const usage = ref(null)
const system = ref({environmentEnabled: false, enabled: false, deliveryEnabled: false})
const runs = ref([])
const loading = ref(true)
const loadingUsage = ref(true)
const dialogOpen = ref(false)
const editingMonitor = ref(null)
const saving = ref(false)
const savingSystem = ref(false)
const previewingId = ref(0)
const activeDigest = ref(null)
const detailOpen = ref(false)
const delivering = ref(false)
const initialAccountId = computed(() => Number(route.query.accountId) || 0)
const alerts = computed(() => {
  const values = []
  if (!system.value.environmentEnabled) values.push('aiAlertEnvironmentOff')
  if ((usage.value?.estimatedNeurons || 0) >= (usage.value?.limits?.maxDailyEstimatedNeurons || 1) * .7) values.push('aiAlertBudget70')
  else if ((usage.value?.estimatedNeurons || 0) >= (usage.value?.limits?.maxDailyEstimatedNeurons || 1) * .5) values.push('aiAlertBudget50')
  if (runs.value.slice(0, 2).length === 2 && runs.value.slice(0, 2).every(run => run.status === 'failed')) values.push('aiAlertConsecutiveFailures')
	const lastSuccess = runs.value.find(run => ['succeeded', 'partial'].includes(run.status))
	if (system.value.enabled && runs.value.length && (!lastSuccess || Date.now() - new Date(`${lastSuccess.finishedAt?.replace(' ', 'T')}Z`).getTime() > 86400000)) values.push('aiAlertNoRecentSuccess')
  if (runs.value.some(run => run.backlogCount > 100)) values.push('aiAlertBacklog')
  if (digests.value.some(digest => digest.deliveryStatus === 'failed' && digest.deliveryAttempts >= 3)) values.push('aiAlertDeliveryFailed')
  return values
})

onMounted(async () => {
  await Promise.all([loadMonitors(), loadDigests(), loadUsage(), loadSystem(), loadRuns()])
  if (initialAccountId.value) openCreate()
  const linkedDigestId = Number(route.query.digestId) || 0
  const linkedEmailId = Number(route.query.emailId) || 0
  if (linkedDigestId) {
    await openDigest(linkedDigestId)
    if (linkedEmailId) await openSource(linkedEmailId)
  }
})

async function loadMonitors() {
  loading.value = true
  try { [monitors.value, accounts.value] = await Promise.all([aiMonitorList(), aiMonitorAccounts()]) }
  finally { loading.value = false }
}
async function loadDigests() {
  loadingDigests.value = true
  try {
    const [dateFrom, dateTo] = digestFilters.value.dateRange || []
    digests.value = await aiDigestList({
      monitorId: digestFilters.value.monitorId || undefined,
      accountId: digestFilters.value.accountId || undefined,
      priority: digestFilters.value.priority || undefined,
      dateFrom,
      dateTo
    })
  } finally { loadingDigests.value = false }
}
async function loadUsage() { loadingUsage.value = true; try { usage.value = await aiUsageToday() } finally { loadingUsage.value = false } }
async function loadSystem() { system.value = await aiSystemState() }
async function loadRuns() { runs.value = await aiRunList() }
function openCreate() { editingMonitor.value = null; dialogOpen.value = true }
function openEdit(monitor) { editingMonitor.value = monitor; dialogOpen.value = true }
function accountLabel(ids) { return ids.map(id => accounts.value.find(account => account.accountId === id)?.email).filter(Boolean).join(' · ') }
function formatTime(value) {
  if (!value) return ''
  const timestamp = value.includes('T') ? value : value.replace(' ', 'T')
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`
  return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(normalized))
}
function formatDigestWindow(digest) {
  if (!digest.periodStart || digest.periodStart.startsWith('manual:')) return formatTime(digest.createdAt)
  return `${formatTime(digest.periodStart)} – ${formatTime(digest.periodEnd)}`
}
async function resetDigestFilters() {
  digestFilters.value = {monitorId: null, accountId: null, dateRange: null, priority: null}
  await loadDigests()
}
function priorityType(priority) { return priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'info' }
function deliveryType(status) { return status === 'sent' ? 'success' : status === 'failed' ? 'danger' : 'info' }
function runStatusType(status) { return ['succeeded', 'partial'].includes(status) ? 'success' : status === 'failed' ? 'danger' : status === 'skipped' ? 'warning' : 'info' }

async function updateSystem() {
  savingSystem.value = true
  try {
    system.value = await aiSystemUpdate({enabled: system.value.enabled, deliveryEnabled: system.value.deliveryEnabled})
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
  } catch (error) {
    await loadSystem()
    throw error
  } finally { savingSystem.value = false }
}

async function saveMonitor(form) {
  saving.value = true
  try {
    const payload = {...form}
    if (form.monitorId) await aiMonitorUpdate(form.monitorId, payload)
    else await aiMonitorCreate(payload)
    dialogOpen.value = false
    await loadMonitors()
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
  } finally { saving.value = false }
}
async function removeMonitor(monitor) {
  await ElMessageBox.confirm(t('aiDeleteMonitorConfirm', {name: monitor.name}), {confirmButtonText: t('confirm'), cancelButtonText: t('cancel'), type: 'warning'})
  await aiMonitorDelete(monitor.monitorId)
  await loadMonitors()
}
async function preview(monitor) {
  previewingId.value = monitor.monitorId
  try {
    const digest = await aiDigestPreview(monitor.monitorId)
    await Promise.all([loadDigests(), loadUsage(), loadRuns()])
    activeDigest.value = digest
    detailOpen.value = true
    ElMessage({message: t('aiPreviewReady'), type: 'success', plain: true})
  } finally { previewingId.value = 0 }
}
async function openDigest(digestId) { activeDigest.value = await aiDigestDetail(digestId); detailOpen.value = true }
async function toggleRetained() {
  const retained = !activeDigest.value.retained
  await aiDigestSetRetained(activeDigest.value.digestId, retained)
  activeDigest.value.retained = retained
  await loadDigests()
}
async function deliverDigest() {
  delivering.value = true
  try {
    await aiDigestDeliver(activeDigest.value.digestId)
    await loadDigests()
    activeDigest.value = await aiDigestDetail(activeDigest.value.digestId)
    ElMessage({message: t('aiDigestDelivered'), type: 'success', plain: true})
  } finally { delivering.value = false }
}
async function deleteDigest() {
  await ElMessageBox.confirm(t('aiDeleteDigestConfirm'), {confirmButtonText: t('confirm'), cancelButtonText: t('cancel'), type: 'warning'})
  await aiDigestDelete(activeDigest.value.digestId)
  detailOpen.value = false
  activeDigest.value = null
  await loadDigests()
}
async function openSource(emailId) {
  const email = await aiDigestSource(activeDigest.value.digestId, emailId)
  emailStore.contentData = {email, delType: 'logic', showStar: false, showReply: false, showUnread: false, readOnly: true}
  detailOpen.value = false
  router.push({name: 'content'})
}
</script>

<style scoped>
.ai-page { height: 100%; overflow: auto; padding: 28px; background: var(--el-fill-color-lighter); box-sizing: border-box; }
.page-header, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.page-header { margin: 0 auto 22px; max-width: 1180px; }
.page-header h1 { margin: 4px 0 8px; font-size: clamp(26px, 4vw, 38px); }
.page-header p, .section-heading p { margin: 0; color: var(--secondary-text-color); }
.eyebrow { color: var(--el-color-primary); font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
.budget-card, .section-block { max-width: 1180px; margin: 0 auto; }
.system-card { max-width: 1180px; margin: 14px auto 0; padding: 18px 20px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.system-card h2 { margin: 4px 0 6px; font-size: 18px; }
.system-card p { margin: 0; color: var(--secondary-text-color); }
.system-switches { display: grid; justify-items: end; gap: 8px; min-width: 190px; }
.alerts { max-width: 1180px; margin: 12px auto 0; display: grid; gap: 8px; }
.section-block { margin-top: 28px; }
.section-heading { margin-bottom: 14px; }
.section-heading h2 { margin: 0 0 5px; font-size: 20px; }
.monitor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.monitor-card { padding: 18px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }
.monitor-top { display: flex; justify-content: space-between; gap: 12px; }
.monitor-top h3 { margin: 0 0 6px; }
.monitor-top p { margin: 0; color: var(--secondary-text-color); font-size: 13px; overflow-wrap: anywhere; }
.monitor-meta { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; color: var(--secondary-text-color); font-size: 12px; }
.monitor-meta span { display: inline-flex; align-items: center; gap: 5px; }
.monitor-actions { display: flex; align-items: center; flex-wrap: wrap; }
.digest-filters { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(190px, 1.2fr) minmax(260px, 1.5fr) minmax(150px, 1fr) auto; gap: 10px; margin-bottom: 12px; padding: 14px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }
.filter-actions { display: flex; align-items: center; }
.digest-list { overflow: hidden; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }
.digest-row { width: 100%; display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 16px 18px; border: 0; border-bottom: 1px solid var(--el-border-color-lighter); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.digest-row:last-child { border-bottom: 0; }
.digest-row:hover { background: var(--el-fill-color-light); }
.digest-mark { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.digest-copy strong, .digest-copy small, .digest-copy span { display: block; }
.digest-copy small { margin: 3px 0 6px; color: var(--secondary-text-color); }
.digest-copy span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.digest-stats { display: flex; align-items: center; gap: 10px; }
.overview { padding: 16px; border-radius: 10px; background: var(--el-fill-color-light); line-height: 1.7; }
.digest-detail-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--secondary-text-color); font-size: 12px; }
.detail-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
.run-table { border-radius: 12px; }
.source-card { padding: 18px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.source-head { display: flex; align-items: center; gap: 8px; color: var(--secondary-text-color); font-size: 12px; }
.source-card h3 { margin: 10px 0 8px; }
.source-card p, .source-card li { line-height: 1.65; }
.source-link { border: 0; padding: 0; display: inline-flex; align-items: center; gap: 5px; color: var(--el-color-primary); background: transparent; cursor: pointer; }
@media (max-width: 1000px) { .digest-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 767px) { .ai-page { padding: 18px 14px; } .page-header { display: block; } .page-header .el-button { margin-top: 14px; } .system-card { display: block; } .system-switches { justify-items: start; margin-top: 14px; } .digest-filters { grid-template-columns: 1fr; } .digest-row { grid-template-columns: 38px minmax(0, 1fr); } .digest-stats { display: none; } .run-table { overflow-x: auto; } }
</style>
