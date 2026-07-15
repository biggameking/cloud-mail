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
            <span><Icon icon="solar:shield-check-linear"/>{{ $t('aiAttachmentsExcluded') }}</span>
          </div>
          <div class="monitor-actions">
            <el-button :loading="previewingId === monitor.monitorId" :disabled="!usage?.enabled" type="primary" plain @click="preview(monitor)">{{ $t('aiSafePreview') }}</el-button>
            <el-button @click="openEdit(monitor)">{{ $t('settings') }}</el-button>
            <el-button type="danger" text @click="removeMonitor(monitor)">{{ $t('delete') }}</el-button>
          </div>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading"><div><h2>{{ $t('aiDigestFeed') }}</h2><p>{{ $t('aiDigestFeedDesc') }}</p></div></div>
      <el-empty v-if="!digests.length" :description="$t('aiNoDigests')"/>
      <div class="digest-list" v-else>
        <button v-for="digest in digests" :key="digest.digestId" class="digest-row" type="button" @click="openDigest(digest.digestId)">
          <span class="digest-mark"><Icon icon="hugeicons:ai-magic" width="20"/></span>
          <span class="digest-copy"><strong>{{ digest.title }}</strong><small>{{ digest.monitorName }} · {{ formatTime(digest.createdAt) }}</small><span>{{ digest.overview }}</span></span>
          <span class="digest-stats">
            <el-tag size="small" :type="deliveryType(digest.deliveryStatus)">{{ $t(`aiDelivery_${digest.deliveryStatus}`) }}</el-tag>
            <el-tag v-if="digest.importantCount" type="danger">{{ $t('aiImportantCount', {count: digest.importantCount}) }}</el-tag>
            <Icon icon="ep:arrow-right"/>
          </span>
        </button>
      </div>
    </section>

    <el-drawer v-model="detailOpen" :title="activeDigest?.title" size="min(720px, 100%)">
      <div v-if="activeDigest" class="digest-detail">
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
import {aiMonitorAccounts, aiMonitorCreate, aiMonitorDelete, aiMonitorList, aiMonitorUpdate} from '@/request/ai-monitor';
import {aiDigestDetail, aiDigestList, aiDigestPreview, aiDigestSource, aiUsageToday} from '@/request/ai-digest';
import {useEmailStore} from '@/store/email';

defineOptions({name: 'ai-digest'})
const {t} = useI18n()
const route = useRoute()
const router = useRouter()
const emailStore = useEmailStore()
const monitors = ref([])
const accounts = ref([])
const digests = ref([])
const usage = ref(null)
const loading = ref(true)
const loadingUsage = ref(true)
const dialogOpen = ref(false)
const editingMonitor = ref(null)
const saving = ref(false)
const previewingId = ref(0)
const activeDigest = ref(null)
const detailOpen = ref(false)
const initialAccountId = computed(() => Number(route.query.accountId) || 0)

onMounted(async () => {
  await Promise.all([loadMonitors(), loadDigests(), loadUsage()])
  if (initialAccountId.value) openCreate()
})

async function loadMonitors() {
  loading.value = true
  try { [monitors.value, accounts.value] = await Promise.all([aiMonitorList(), aiMonitorAccounts()]) }
  finally { loading.value = false }
}
async function loadDigests() { digests.value = await aiDigestList() }
async function loadUsage() { loadingUsage.value = true; try { usage.value = await aiUsageToday() } finally { loadingUsage.value = false } }
function openCreate() { editingMonitor.value = null; dialogOpen.value = true }
function openEdit(monitor) { editingMonitor.value = monitor; dialogOpen.value = true }
function accountLabel(ids) { return ids.map(id => accounts.value.find(account => account.accountId === id)?.email).filter(Boolean).join(' · ') }
function formatTime(value) { return value ? new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(`${value.replace(' ', 'T')}Z`)) : '' }
function priorityType(priority) { return priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'info' }
function deliveryType(status) { return status === 'sent' ? 'success' : status === 'failed' ? 'danger' : 'info' }

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
    await Promise.all([loadDigests(), loadUsage()])
    activeDigest.value = digest
    detailOpen.value = true
    ElMessage({message: t('aiPreviewReady'), type: 'success', plain: true})
  } finally { previewingId.value = 0 }
}
async function openDigest(digestId) { activeDigest.value = await aiDigestDetail(digestId); detailOpen.value = true }
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
.source-card { padding: 18px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.source-head { display: flex; align-items: center; gap: 8px; color: var(--secondary-text-color); font-size: 12px; }
.source-card h3 { margin: 10px 0 8px; }
.source-card p, .source-card li { line-height: 1.65; }
.source-link { border: 0; padding: 0; display: inline-flex; align-items: center; gap: 5px; color: var(--el-color-primary); background: transparent; cursor: pointer; }
@media (max-width: 767px) { .ai-page { padding: 18px 14px; } .page-header { display: block; } .page-header .el-button { margin-top: 14px; } .digest-row { grid-template-columns: 38px minmax(0, 1fr); } .digest-stats { display: none; } }
</style>
