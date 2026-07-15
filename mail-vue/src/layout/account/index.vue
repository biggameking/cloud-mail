<template>
  <div class="account-box">
    <div class="head-opt">
      <el-select
          v-if="isSuperAdmin"
          v-model="scopeValue"
          class="mailbox-scope"
          :placeholder="$t('mailboxView')"
          @change="changeMailboxScope"
      >
        <el-option :label="$t('myMailbox')" value="self"/>
        <el-option v-if="aggregateEnabled" :label="$t('allUsersInbox')" value="aggregate"/>
        <el-option
            v-for="item in mailboxUsers"
            :key="item.userId"
            :label="item.email"
            :value="`user:${item.userId}`"
        />
      </el-select>
      <Icon v-if="isSelfScope" v-perm="'account:add'" class="icon add" icon="ion:add-outline" width="23" height="23" @click="add"/>
      <Icon class="icon refresh" icon="ion:reload" width="18" height="18" @click="refresh"/>
    </div>
    <el-scrollbar class="scrollbar" ref="scrollbarRef">
      <div v-infinite-scroll="getAccountList" :infinite-scroll-distance="600" :infinite-scroll-immediate="false">
        <el-card class="item" :class="itemBg(item.accountId)" v-for="(item, index) in visibleAccounts" :key="item.accountId"
                 @click="changeAccount(item)">
          <div class="account-heading">
            <div class="account">{{ item.email }}</div>
            <Icon v-if="item.managedUser" class="managed-user-icon" icon="mynaui:user" width="17" height="17"/>
          </div>
          <div class="opt">
            <button class="card-icon-button inbox-default-button" type="button" @click.stop="setAllReceive(item)" :title="$t('setDefaultInbox')">
              <Icon v-if="!item.allReceive" icon="eva:email-fill" width="21" height="21" color="#e8b813"/>
              <Icon v-else icon="flat-color-icons:folder" width="21" height="21"/>
              <span class="unread-count" :class="{'has-unread': item.unreadCount > 0}">{{ item.unreadCount || 0 }}</span>
            </button>
            <div class="settings" @click.stop>
              <button class="card-icon-button" type="button" :title="$t('copy')" @click.stop="copyAccount(item.email)">
                <Icon icon="fluent-color:clipboard-24" width="20" height="20"/>
              </button>
              <el-dropdown>
                <button class="card-icon-button" type="button" :title="$t('settings')">
                  <Icon icon="fluent:settings-24-filled" width="20" height="20" color="#7b8490"/>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="hasPerm('email:send')" @click="openSetName(item)">{{ $t('rename') }}</el-dropdown-item>
					<el-dropdown-item @click="openSetForward(item)">{{ $t('forwarding') }}</el-dropdown-item>
                    <el-dropdown-item v-if="isSelfScope && !item.managedUser && item.accountId !== userStore.user.account.accountId" @click="setAsTop(item, index)">{{ $t('pin') }}</el-dropdown-item>
                    <el-dropdown-item v-if="isSelfScope && !item.managedUser && item.accountId !== userStore.user.account.accountId && hasPerm('account:delete')"
                                      @click="remove(item)">{{ $t('delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </el-card>

        <!-- Initial Loading Skeleton -->
        <template v-if="loading">
          <el-skeleton v-for="i in skeletonRows" :key="i" animated>
            <template #template>
              <el-card class="item">
                <el-skeleton-item variant="p" style="width: 70%; height: 20px; margin-bottom: 25px"/>
                <div style="display: flex; justify-content: space-between">
                  <el-skeleton-item variant="text" style="width: 20px"/>
                  <el-skeleton-item variant="text" style="width: 20px"/>
                </div>
              </el-card>
            </template>
          </el-skeleton>
        </template>

        <!-- Follow Loading Skeleton -->
        <template v-if="accounts.length > 0 && !noLoading">
          <el-skeleton animated>
            <template #template>
              <el-card class="item">
                <el-skeleton-item variant="p" style="width: 70%; height: 20px; margin-bottom: 20px"/>
                <div style="display: flex; justify-content: space-between">
                  <el-skeleton-item variant="text" style="width: 20px"/>
                  <el-skeleton-item variant="text" style="width: 20px"/>
                </div>
              </el-card>
            </template>
          </el-skeleton>
        </template>

        <div class="noLoading" v-if="noLoading && accounts.length > 0">
          <div>{{ $t('noMoreData') }}</div>
        </div>
        <div class="empty" v-if="noLoading && accounts.length === 0">
          <el-empty :description="$t('noMessagesFound')"/>
        </div>
      </div>

    </el-scrollbar>
    <el-dialog v-model="showAdd" :title="$t('addAccount')">
      <div class="container">
        <el-input v-model="addForm.email" ref="addRef" type="text" :placeholder="$t('emailAccount')" autocomplete="off">
          <template #append>
            <div @click.stop="openSelect">
              <el-select
                  ref="mySelect"
                  v-model="addForm.suffix"
                  :placeholder="$t('select')"
                  class="select"
              >
                <el-option
                    v-for="item in domainList"
                    :key="item"
                    :label="item"
                    :value="item"
                />
              </el-select>
              <div>
                <span>{{ addForm.suffix }}</span>
                <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
              </div>
            </div>
          </template>
        </el-input>
        <el-button class="btn" type="primary" @click="submit" :loading="addLoading"
        >{{ $t('add') }}
        </el-button>
      </div>
      <div
          class="add-email-turnstile"
          :class="verifyShow ? 'turnstile-show' : 'turnstile-hide'"
          :data-sitekey="settingStore.settings.siteKey"
          data-callback="onTurnstileSuccess"
          data-error-callback="onTurnstileError"
      >
        <span style="font-size: 12px;color: #F56C6C" v-if="botJsError">{{ $t('verifyModuleFailed') }}</span>
      </div>
    </el-dialog>
    <el-dialog v-model="setNameShow" :title="$t('changeUserName')">
      <div class="container">
        <el-input v-model="accountName" type="text" :placeholder="$t('username')" autocomplete="off">
        </el-input>
        <el-button class="btn" type="primary" @click="setName" :loading="setNameLoading"
        >{{ $t('save') }}
        </el-button>
      </div>
    </el-dialog>
	<el-dialog v-model="setForwardShow" :title="$t('forwarding')">
	  <div class="container forward-form">
		<el-switch v-model="forwardForm.enabled" :active-text="$t('enableForwarding')"/>
		<el-input
		  v-model="forwardForm.forwardEmail"
		  type="email"
		  :disabled="!forwardForm.enabled"
		  :placeholder="$t('forwardingAddress')"
		  autocomplete="off"
		/>
		<el-alert :title="$t('forwardingVerificationHint')" type="warning" :closable="false" show-icon/>
		<el-button class="btn" type="primary" @click="saveForward" :loading="setForwardLoading">
		  {{ $t('save') }}
		</el-button>
	  </div>
	</el-dialog>
  </div>
</template>
<script setup>
import {Icon} from "@iconify/vue";
import {computed, nextTick, reactive, ref, watch} from "vue";
import {
  accountList,
  accountAdd,
  accountDelete,
  accountSetName,
	accountSetForward,
  accountSetAllReceive,
  accountSetAsTop
} from "@/request/account.js";
import {sleep} from "@/utils/time-utils.js"
import {isEmail} from "@/utils/verify-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useUserStore} from "@/store/user.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {AccountAllReceiveEnum} from "@/enums/account-enum.js";
import {
  adminMailboxAccounts,
  adminMailboxSetAllReceive,
  adminMailboxSetForward,
  adminMailboxSetName,
  adminMailboxUsers
} from "@/request/admin-mailbox.js";

const {t} = useI18n();
const userStore = useUserStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const emailStore = useEmailStore();
const showAdd = ref(false)
const addLoading = ref(false);
const domainList = computed(() => settingStore.domainList)
const accounts = reactive([])
const noLoading = ref(false)
const loading = ref(false)
const followLoading = ref(false);
const verifyShow = ref(false)
const setNameShow = ref(false)
const setNameLoading = ref(false)
const setForwardShow = ref(false)
const setForwardLoading = ref(false)
const accountName = ref(null)
const addRef = ref({})
const scrollbarRef = ref({})
let account = null
let turnstileId = null
const botJsError = ref(false)
let verifyToken = ''
let verifyErrorCount = 0
let first = true
const addForm = reactive({
  email: '',
  suffix: settingStore.domainList[0]
})
const forwardForm = reactive({enabled: false, forwardEmail: ''})
let forwardAccount = null
let skeletonRows = 10
const queryParams = {
  size: 30
}

const mySelect = ref()
const mailboxUsers = ref([])
const managedAccounts = ref([])
const scopeValue = ref('self')
const isSuperAdmin = computed(() => userStore.user.type === 0)
const isSelfScope = computed(() => accountStore.mailboxScope === 'self')
const aggregateEnabled = computed(() => settingStore.settings.adminAggregateInbox === 0)
const visibleAccounts = computed(() => isSelfScope.value && isSuperAdmin.value
    ? [...accounts, ...managedAccounts.value]
    : accounts)

if (hasPerm('account:query')) {
  getAccountList()
}

if (isSuperAdmin.value) {
  adminMailboxUsers().then(list => {
    mailboxUsers.value = list
    managedAccounts.value = list.filter(item => item.accountId).map(item => ({
      accountId: item.accountId,
      email: item.accountEmail,
      name: item.accountName,
      allReceive: item.allReceive,
      unreadCount: item.unreadCount,
      forwardEnabled: item.forwardEnabled,
      forwardEmail: item.forwardEmail,
      sort: item.sort,
      managedUser: true,
      ownerUserId: item.userId,
      ownerEmail: item.email
    }))
  })
}

watch(() => accountStore.changeUserAccountName, () => {
  accounts[0].name = accountStore.changeUserAccountName
})

watch(() => settingStore.domainList, (list) => {
  if (!addForm.suffix && list.length > 0) {
    addForm.suffix = list[0]
  }
}, {immediate: true})

watch(aggregateEnabled, enabled => {
  if (!enabled && accountStore.mailboxScope === 'aggregate') {
    scopeValue.value = 'self'
    changeMailboxScope('self')
  }
})


const openSelect = () => {
  mySelect.value.toggleMenu()
}

window.onTurnstileError = (e) => {
  if (verifyErrorCount >= 4) {
    return
  }
  verifyErrorCount++
  console.warn('人机验加载失败', e)
  setTimeout(() => {
    nextTick(() => {
      if (!turnstileId) {
        turnstileId = window.turnstile.render('.add-email-turnstile')
      } else {
        window.turnstile.reset(turnstileId);
      }
    })
  }, 1500)
};

window.onTurnstileSuccess = (token) => {
  verifyToken = token;
};

function getSkeletonRows() {
  if (accounts.length > 20) return skeletonRows = 20
  if (accounts.length === 0) return skeletonRows = 1
  skeletonRows = accounts.length
}

function setName() {

  let name = accountName.value

  if (name === account.name) {
    setNameShow.value = false
    return
  }

  if (!name) {
    ElMessage({
      message: t('emptyUserNameMsg'),
      type: 'error',
      plain: true,
    })
    return;
  }

  setNameLoading.value = true
  const request = account.managedUser
      ? adminMailboxSetName(account.accountId, name)
      : accountSetName(account.accountId, name)
  request.then(() => {
    account.name = name
    setNameShow.value = false

    if (account.accountId === userStore.user.account.accountId) {
      userStore.user.name = name
    }

    ElMessage({
      message: t('saveSuccessMsg'),
      type: "success",
      plain: true
    })
  }).finally(() => {
    setNameLoading.value = false
  })
}

function openSetName(accountItem) {
  accountName.value = accountItem.name
  account = accountItem
  setNameShow.value = true
}

function openSetForward(accountItem) {
  forwardAccount = accountItem
  forwardForm.enabled = Boolean(accountItem.forwardEnabled)
  forwardForm.forwardEmail = accountItem.forwardEmail || ''
  setForwardShow.value = true
}

function saveForward() {
  const target = forwardForm.forwardEmail.trim().toLowerCase()
  if (forwardForm.enabled && !isEmail(target)) {
    ElMessage({message: t('invalidForwardingEmail'), type: 'error', plain: true})
    return
  }

  setForwardLoading.value = true
  const request = forwardAccount.managedUser
      ? adminMailboxSetForward(forwardAccount.accountId, forwardForm.enabled, target)
      : accountSetForward(forwardAccount.accountId, forwardForm.enabled, target)
  request.then(() => {
    forwardAccount.forwardEnabled = forwardForm.enabled ? 1 : 0
    forwardAccount.forwardEmail = forwardForm.enabled ? target : ''
    setForwardShow.value = false
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
  }).finally(() => {
    setForwardLoading.value = false
  })
}

async function setAllReceive(account) {
  const candidates = account.managedUser
      ? visibleAccounts.value.filter(item => item.managedUser && item.ownerUserId === account.ownerUserId)
      : accounts.filter(item => !item.managedUser)
  const previous = candidates.map(item => ({item, allReceive: item.allReceive}))
  const enabling = account.allReceive === AccountAllReceiveEnum.DISABLED
  candidates.forEach(item => item.allReceive = AccountAllReceiveEnum.DISABLED)
  account.allReceive = enabling ? AccountAllReceiveEnum.ENABLED : AccountAllReceiveEnum.DISABLED
  try {
    const request = account.managedUser
        ? adminMailboxSetAllReceive(account.accountId)
        : accountSetAllReceive(account.accountId)
    await request
    if (account.allReceive === AccountAllReceiveEnum.ENABLED) {
      ElMessage({
        message: t('setSuccess'),
        type: 'success',
        plain: true,
      })
    }
    changeAccount(account);
    emailStore.emailScroll?.refreshList();
    emailStore.sendScroll?.refreshList();
  } catch (error) {
    previous.forEach(({item, allReceive}) => item.allReceive = allReceive)
    throw error
  }
}


function showNullSetting(item) {
  return false
}

function itemBg(accountId) {
  return accountStore.currentAccountId === accountId ? 'item-choose' : ''
}



function remove(account) {
  ElMessageBox.confirm(t('delConfirm', {msg: account.email}), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    accountDelete(account.accountId).then(() => {
      const index = accounts.findIndex(item => item.accountId === account.accountId);
      accounts.splice(index, 1);
      if (accounts.length < queryParams.size) {
        getAccountList()
      }
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true,
      })
    })
  });
}

function refresh() {
  if (loading.value) {
    return
  }
  loading.value = false
  followLoading.value = false
  noLoading.value = false
  queryParams.accountId = 0
  queryParams.lastSort = null
  getSkeletonRows();
  scrollbarRef.value?.setScrollTop?.(0)
  accounts.splice(0, accounts.length)
  getAccountList()
}

function changeAccount(account) {
  accountStore.currentAccountId = account.accountId
  accountStore.currentAccount = account
}

function changeMailboxScope(value) {
  if (value === 'self') {
    accountStore.mailboxScope = 'self'
    accountStore.viewUserId = 0
    accountStore.viewUserEmail = ''
  } else if (value === 'aggregate') {
    accountStore.mailboxScope = 'aggregate'
    accountStore.viewUserId = 0
    accountStore.viewUserEmail = ''
  } else {
    const userId = Number(value.split(':')[1])
    const selected = mailboxUsers.value.find(item => item.userId === userId)
    accountStore.mailboxScope = 'user'
    accountStore.viewUserId = userId
    accountStore.viewUserEmail = selected?.email || ''
  }
  accountStore.currentAccountId = 0
  accountStore.currentAccount = {}
  refresh()
}

function add() {
  addForm.suffix = addForm.suffix || settingStore.domainList[0]
  showAdd.value = true
  setTimeout(() => {
    addRef.value.focus()
  }, 100)
}

function setAsTop(account, index) {
  accountSetAsTop(account.accountId).then(() => {
    ElMessage({
      message: t('setSuccess'),
      type: 'success',
      plain: true,
    })

    const [item] = accounts.splice(index, 1);
    accounts.splice(1, 0, item);

  });
}

async function copyAccount(account) {
  try {
    await navigator.clipboard.writeText(account);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true,
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true,
    })
  }
}

function getAccountList() {

  if (loading.value || followLoading.value || noLoading.value) return;

  if (accounts.length === 0) {
    loading.value = true
  } else {
    followLoading.value = true
  }

  if (accountStore.mailboxScope === 'aggregate') {
    const aggregate = {accountId: -1, email: t('allUsersInbox'), allReceive: 1, sort: 0}
    accounts.push(aggregate)
    accountStore.currentAccountId = aggregate.accountId
    accountStore.currentAccount = aggregate
    loading.value = false
    followLoading.value = false
    noLoading.value = true
    return
  }

  let start = Date.now();

  const accountId = accounts.length > 0 ? accounts.at(-1).accountId : 0;
  const lastSort = accounts.length > 0 ? accounts.at(-1).sort : null;

  const listRequest = accountStore.mailboxScope === 'user'
      ? adminMailboxAccounts(accountStore.viewUserId, accountId, queryParams.size, lastSort)
      : accountList(accountId, queryParams.size, lastSort)

  listRequest.then(async list => {

    if (accountStore.mailboxScope === 'user') {
      list = list.map(item => ({
        ...item,
        managedUser: true,
        ownerUserId: accountStore.viewUserId,
        ownerEmail: accountStore.viewUserEmail
      }))
    }

    let end = Date.now();
    let duration = end - start;
    if (duration < 300) {
      await sleep(300 - duration)
    }

    if (list.length < queryParams.size) {
      noLoading.value = true
    }
    if (accounts.length === 0) {
      accountStore.currentAccount = list[0]
      accountStore.currentAccountId = list[0]?.accountId || 0
    }

    accounts.push(...list)

    loading.value = false
    followLoading.value = false
    first = false
  }).catch(() => {
    loading.value = false
    followLoading.value = false
  })
}


function submit() {

  if (!addForm.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: "error",
      plain: true
    })
    return
  }

  if (addForm.email.length < settingStore.settings.minEmailPrefix) {
    ElMessage({
      message: t('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!isEmail(addForm.email + addForm.suffix)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: "error",
      plain: true
    })
    return
  }

  if (!verifyToken && (settingStore.settings.addEmailVerify === 0 || (settingStore.settings.addEmailVerify === 2 && settingStore.settings.addVerifyOpen))) {
    if (!verifyShow.value) {
      verifyShow.value = true
      nextTick(() => {
        if (!turnstileId) {
          try {
            turnstileId = window.turnstile.render('.add-email-turnstile')
          } catch (e) {
            botJsError.value = true
            console.log('人机验证js加载失败')
          }
        } else {
          window.turnstile.reset('.add-email-turnstile')
        }
      })
    } else if (!botJsError.value) {
      ElMessage({
        message: t('botVerifyMsg'),
        type: "error",
        plain: true
      })
    }
    return;
  }

  addLoading.value = true
  accountAdd(addForm.email + addForm.suffix, verifyToken).then(account => {
    addLoading.value = false
    showAdd.value = false
    addForm.email = ''
    accounts.push(account)
    verifyToken = ''
    settingStore.settings.addVerifyOpen = account.addVerifyOpen
    ElMessage({
      message: t('addSuccessMsg'),
      type: "success",
      plain: true
    })
    verifyShow.value = false
    userStore.refreshUserInfo()
  }).catch(res => {
    if (res.code === 400) {
      verifyToken = ''
      if (turnstileId) {
        window.turnstile.reset(turnstileId)
      } else {
        nextTick(() => {
          turnstileId = window.turnstile.render('.add-email-turnstile')
        })
      }
      verifyShow.value = true
    }
    addLoading.value = false
  })
}
</script>
<style>
path[fill="#ffdda1"] {
  fill: #ffdd7d;
}
</style>
<style scoped lang="scss">
.account-box {

  border-right: 1px solid var(--el-border-color) !important;
  background-color: var(--el-bg-color);
  height: 100%;
  overflow: hidden;

  .head-opt {
    display: flex;
    align-items: center;
    height: 38px;
    box-shadow: var(--header-actions-border);
    padding-left: 10px;
    padding-right: 10px;

    .mailbox-scope {
      flex: 1;
      min-width: 0;
      margin-right: 6px;
    }

    .icon {
      cursor: pointer;
    }

    .refresh {
      margin-left: 10px;
    }

    .add {
      margin-left: 2px;
    }

    .head-opt:not(.add) .refresh {
      margin-left: 5px;
    }
  }

  .scrollbar {
    width: 100%;
    height: calc(100% - 38px);
    overflow: auto;
    @media (max-width: 767px) {
      height: calc(100% - 98px);
    }

    .empty {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    }

    .noLoading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 10px 0;
      color: var(--secondary-text-color);
    }
  }

  .btn {
    width: 100%;
    margin-top: 15px;
  }

	.forward-form {
	  display: grid;
	  gap: 14px;
	}

  .item {
    position: relative;
    background-color: var(--el-bg-color);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
    margin-left: 10px;
    margin-right: 10px;
    cursor: pointer;

    .account-heading {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 18px;
      align-items: center;
      gap: 8px;
      margin-bottom: 18px;
    }

    .account {
      font-weight: 600;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .managed-user-icon {
      color: var(--el-color-primary);
    }

    .opt {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #888;

      .settings {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .card-icon-button {
        min-width: 28px;
        height: 28px;
        padding: 0 4px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        cursor: pointer;
        transition: background-color 160ms ease, transform 160ms ease;
      }

      .card-icon-button:hover {
        background: var(--light-ill);
      }

      .card-icon-button:active {
        transform: translateY(1px);
      }

      .inbox-default-button {
        padding-left: 2px;
      }

      .unread-count {
        min-width: 17px;
        padding: 0 4px;
        border-radius: 8px;
        color: var(--secondary-text-color);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        line-height: 17px;
        text-align: center;
      }

      .unread-count.has-unread {
        color: #fff;
        background: var(--el-color-primary);
        font-weight: 600;
      }
    }

    :deep(.el-card__body) {
      padding: 0;
    }
  }

  .item:first-child {
    margin-top: 10px;
  }

  .item-choose {
    background: var(--choose-account-background);
  }

}


.setting-icon {
  position: relative;
  top: 6px;
}

:deep(.el-input-group__append) {
  padding: 0 !important;
  padding-left: 8px !important;
  background: var(--el-bg-color);
}

:deep(.el-dialog) {
  width: 400px !important;
  @media (max-width: 440px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

.select {
  position: absolute;
  right: 30px;
  width: 100px;
  opacity: 0;
  pointer-events: none;
}

:deep(.el-pagination .el-select) {
  width: 100px;
  background: var(--el-bg-color);
}

.add-email-turnstile {
  margin-top: 15px;
}

.turnstile-show {
  opacity: 1;
}

.turnstile-hide {
  opacity: 0;
  pointer-events: none;
  position: fixed;
}

</style>
