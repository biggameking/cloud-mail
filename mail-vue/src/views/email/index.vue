<template>
  <emailScroll ref="scroll"
               :cancel-success="cancelStar"
               :star-success="addStar"
               :getEmailList="getEmailList"
               :emailDelete="emailDelete"
               :star-add="starAdd"
               :star-cancel="starCancel"
               :time-sort="params.timeSort"
               :email-read="emailRead"
               :show-unread="true"
               :read-only="isAdminView"
               :show-star="!isAdminView"
               :allow-star="!isAdminView"
               :show-user-info="isAggregateView"
               :type="isAggregateView ? 'all-email' : 'email'"
               actionLeft="4px"
               @jump="jumpContent"
  >
    <template #first>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
            v-if="params.timeSort === 0" width="28" height="28"/>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
            width="28" height="28"/>
    </template>

  </emailScroll>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useSettingStore} from "@/store/setting.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete, emailLatest, emailRead} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {computed, defineOptions, h, onMounted, reactive, ref, watch} from "vue";
import {sleep} from "@/utils/time-utils.js";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import { useRoute } from 'vue-router'
import {adminMailboxLatest, adminMailboxList} from "@/request/admin-mailbox.js";

defineOptions({
  name: 'email'
})

const route = useRoute();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const scroll = ref({})
const params = reactive({
  timeSort: 0,
})
const isManagedCardView = computed(() => Boolean(accountStore.currentAccount.managedUser))
const isAdminView = computed(() => accountStore.mailboxScope !== 'self' || isManagedCardView.value)
const isAggregateView = computed(() => accountStore.mailboxScope === 'aggregate')

onMounted(() => {
  emailStore.emailScroll = scroll;
  latest()
})


watch(() => [accountStore.currentAccountId, accountStore.mailboxScope, accountStore.viewUserId], () => {
  scroll.value.refreshList();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  scroll.value.refreshList();
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showUnread = true
  emailStore.contentData.showStar = !isAdminView.value
  emailStore.contentData.showReply = !isAdminView.value
  emailStore.contentData.readOnly = isAdminView.value
  router.push('/message')
}

const existIds = new Set();

async function latest() {
  while (true) {

    let autoRefresh = settingStore.settings.autoRefresh;
    await sleep(autoRefresh > 1 ? autoRefresh * 1000 : 3000);

    if (route.name !== 'email') {
      continue;
    }

    const latestId = scroll.value.latestEmail?.emailId

    if (!scroll.value.firstLoad && autoRefresh > 1) {
      try {
    const accountId = accountStore.currentAccountId
        if (accountId <= 0) {
          continue
        }
        const allReceive = scroll.value.latestEmail?.allReceive
        const curTimeSort = params.timeSort
        let list = []

        //确保发起请求时最后一个邮件是当前账号的,或者
        if (accountId === scroll.value.latestEmail?.reqAccountId) {
          list = isAdminView.value
              ? await adminMailboxLatest(adminMailboxParams(latestId))
              : await emailLatest(latestId, accountId, allReceive);
        }

        //确保请求回来后，账号没有切换，时间排序没有改变，全部邮件类型没变
        if (accountId === accountStore.currentAccountId && params.timeSort === curTimeSort && allReceive === accountStore.currentAccount.allReceive) {
          if (list.length > 0) {

            for (let email of list) {

              email.reqAccountId = accountId;
              email.allReceive = allReceive;

              if (!existIds.has(email.emailId)) {

                existIds.add(email.emailId)
                scroll.value.addItem(email)
				if (email.accountId === accountStore.currentAccountId && email.unread === 0) {
				  accountStore.currentAccount.unreadCount = (accountStore.currentAccount.unreadCount || 0) + 1
				}

                await sleep(50)
              }

            }

          }

        }
      } catch (e) {
        if (e.code === 401 || e.code === 403) {
          settingStore.settings.autoRefresh = 0;
        }
        console.error(e)
      }
    }
  }
}

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

function getEmailList(emailId, size) {
  const accountId =  accountStore.currentAccountId;
  if (accountId <= 0 && !isAggregateView.value) {
    return Promise.resolve({
      list: [],
      total: 0,
      latestEmail: {emailId: 0, accountId: 0, userId: 0}
    })
  }
  const allReceive = accountStore.currentAccount.allReceive;
  const request = isAdminView.value
      ? adminMailboxList({...adminMailboxParams(emailId), size, timeSort: params.timeSort})
      : emailList(accountId, allReceive, emailId, params.timeSort, size, 0)
  return request.then(data => {
    data.latestEmail.reqAccountId = accountId;
    data.latestEmail.allReceive = allReceive;
    return data;
  })
}

function adminMailboxParams(emailId) {
  const managedAccount = accountStore.currentAccount
  return {
    scope: isManagedCardView.value ? 'user' : accountStore.mailboxScope,
    userId: isManagedCardView.value ? managedAccount.ownerUserId : accountStore.viewUserId,
    accountId: accountStore.currentAccountId,
    allReceive: accountStore.currentAccount.allReceive,
    emailId
  }
}

</script>
<style>
.icon {
  cursor: pointer;
}
</style>
