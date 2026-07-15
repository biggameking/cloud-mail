<template>
  <div class="box">
    <div class="header-actions">
      <Icon class="icon" icon="material-symbols-light:arrow-back-ios-new" width="20" height="20" @click="handleBack"/>
      <Icon v-if="!emailStore.contentData.readOnly" v-perm="'email:delete'" class="icon" icon="uiw:delete" width="16" height="16" @click="handleDelete"/>
      <span class="star" v-if="emailStore.contentData.showStar">
        <Icon class="icon" @click="changeStar" v-if="email.isStar" icon="fluent-color:star-16" width="20" height="20"/>
        <Icon class="icon" @click="changeStar" v-else icon="solar:star-line-duotone" width="18" height="18"/>
      </span>
      <Icon class="icon" v-if="emailStore.contentData.showReply" v-perm="'email:send'"  @click="openReply" icon="la:reply" width="21" height="21" />
      <Icon class="icon" v-if="emailStore.contentData.showReply" v-perm="'email:send'"  @click="openForward" icon="iconoir:arrow-up-right" width="20" height="20" />
    </div>
    <div></div>
    <el-scrollbar class="scrollbar">
      <div class="container">
        <header class="message-header">
          <h1 class="email-title">{{ email.subject || $t('noSubject') }}</h1>
          <div class="sender-row">
            <div class="sender-avatar" aria-hidden="true">{{ senderInitial }}</div>
            <div class="sender-meta">
              <div class="sender-primary">
                <strong>{{ email.name || email.sendEmail }}</strong>
                <span class="sender-address">&lt;{{ email.sendEmail }}&gt;</span>
              </div>
              <div class="recipient-line">
                <span>{{ $t('recipient') }}：</span>
                <span>{{ formateReceive(email.recipient) }}</span>
              </div>
            </div>
            <time class="message-time">{{ formatDetailDate(email.createTime) }}</time>
          </div>
        </header>
        <div class="content">
          <div class="email-info">
            <el-alert v-if="email.status === 3" :closable="false" :title="toMessage(email.message)" class="email-msg" type="error" show-icon />
            <el-alert v-if="email.status === 4" :closable="false" :title="$t('complained')" class="email-msg" type="warning" show-icon />
            <el-alert v-if="email.status === 5" :closable="false" :title="$t('delayed')" class="email-msg" type="warning" show-icon />
          </div>
          <div class="message-body" :class="email.attList.length === 0 ? 'bottom-distance' : ''">
            <ShadowHtml class="shadow-html" :html="formatImage(email.content)" v-if="email.content" />
            <pre v-else class="email-text" >{{email.text}}</pre>
          </div>
          <div class="att" v-if="email.attList.length > 0">
            <div class="att-title">
              <span>{{$t('attachments')}}</span>
              <span>{{$t('attCount',{total: email.attList.length})}}</span>
            </div>
            <div class="att-box">

              <div class="att-item" v-for="att in email.attList" :key="att.attId">
                <div class="att-icon" @click="showImage(att.key)">
                  <Icon v-bind="getIconByName(att.filename)" />
                </div>
                <div class="att-name" @click="showImage(att.key)">
                  {{ att.filename }}
                </div>
                <div class="att-size">{{ formatBytes(att.size) }}</div>
                <div class="opt-icon att-icon">
                  <Icon v-if="isImage(att.filename)" icon="hugeicons:view" width="22" height="22" @click="showImage(att.key)"/>
                  <a :href="cvtR2Url(att.key)" download>
                    <Icon icon="system-uicons:push-down" width="22" height="22"/>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <el-image-viewer
        v-if="showPreview"
        :url-list="srcList"
        show-progress
        @close="showPreview = false"
    />
  </div>
</template>
<script setup>
import ShadowHtml from '@/components/shadow-html/index.vue'
import {computed, reactive, ref, watch, onMounted, onUnmounted} from "vue";
import {useRouter} from 'vue-router'
import {ElMessage, ElMessageBox} from 'element-plus'
import {emailDelete, emailRead} from "@/request/email.js";
import {Icon} from "@iconify/vue";
import {useEmailStore} from "@/store/email.js";
import {useAccountStore} from "@/store/account.js";
import {formatDetailDate} from "@/utils/day.js";
import {starAdd, starCancel} from "@/request/star.js";
import {getExtName, formatBytes} from "@/utils/file-utils.js";
import {cvtR2Url,toOssDomain} from "@/utils/convert.js";
import {getIconByName} from "@/utils/icon-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {allEmailDelete} from "@/request/all-email.js";
import {useUiStore} from "@/store/ui.js";
import {useI18n} from "vue-i18n";
import {EmailUnreadEnum} from "@/enums/email-enum.js";

const uiStore = useUiStore();
const settingStore = useSettingStore();
const accountStore = useAccountStore();
const emailStore = useEmailStore();
const router = useRouter()
const email = emailStore.contentData.email
const showPreview = ref(false)
const srcList = reactive([])
const senderInitial = computed(() => (email.name || email.sendEmail || '?').trim().charAt(0).toUpperCase())

const { t } = useI18n()
watch(() => accountStore.currentAccountId, () => {
  handleBack()
})

onMounted(() => {
  if (!emailStore.contentData.readOnly && emailStore.contentData.showUnread && email.unread === EmailUnreadEnum.UNREAD) {
    email.unread = EmailUnreadEnum.READ;
    emailRead([email.emailId]).then(() => {
      if (email.accountId === accountStore.currentAccountId && accountStore.currentAccount.unreadCount > 0) {
        accountStore.currentAccount.unreadCount--
      }
    });
  }
})

onUnmounted(() => {
  emailStore.contentData.showUnread = false;
})

function openReply() {
  uiStore.writerRef.openReply(email)
}

function openForward() {
  uiStore.writerRef.openForward(email)
}

function toMessage(message) {
  return  message ? JSON.parse(message).message : '';
}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return  content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function showImage(key) {
  if (!isImage(key)) return;
  const url = cvtR2Url(key)
  srcList.length = 0
  srcList.push(url)
  showPreview.value = true
}

function isImage(filename) {
  return ['png', 'jpg', 'jpeg', 'bmp', 'gif','jfif'].includes(getExtName(filename))
}

function formateReceive(recipient) {
  try {
    const parsed = typeof recipient === 'string' ? JSON.parse(recipient) : recipient
    return Array.isArray(parsed) ? parsed.map(item => item.address).filter(Boolean).join(', ') : (email.toEmail || '')
  } catch {
    return email.toEmail || ''
  }
}

function changeStar() {
  if (email.isStar) {
    email.isStar = 0;
    starCancel(email.emailId).then(() => {
      email.isStar = 0;
      emailStore.cancelStarEmailId = email.emailId
      setTimeout(() => emailStore.cancelStarEmailId = 0)
      emailStore.starScroll?.deleteEmail([email.emailId])
    }).catch((e) => {
      console.error(e)
      email.isStar = 1;
    })
  } else {
    email.isStar = 1;
    starAdd(email.emailId).then(() => {
      email.isStar = 1;
      emailStore.addStarEmailId = email.emailId
      setTimeout(() => emailStore.addStarEmailId = 0)
      emailStore.starScroll?.addItem(email)
    }).catch((e) => {
      console.error(e)
      email.isStar = 0;
    })
  }
}

const handleBack = () => {
  router.back()
}

const handleDelete = () => {
  ElMessageBox.confirm(t('delEmailConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    if (emailStore.contentData.delType === 'logic') {
      emailDelete(email.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.emailId]
      })
    } else  {

      allEmailDelete(email.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.emailId]
      })
    }

    router.back()
  })
}
</script>
<style scoped lang="scss">
.box {
  height: 100%;
  overflow: hidden;
}

.header-actions {
  padding: 9px 15px 8px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--header-actions-border);
  font-size: 18px;
  .star {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 21px;
  }
  .icon {
    cursor: pointer;
  }
}


.scrollbar {
  height: calc(100% - 38px);
  width: 100%;
}

  .container {
  width: min(100%, 1120px);
  margin: 0 auto;
  padding: 24px 32px 40px;
  font-size: 14px;
  @media (max-width: 1023px) {
    padding: 18px 18px 32px;
  }

  .message-header {
    padding-bottom: 18px;
    border-bottom: 1px solid var(--light-border-color);
  }

  .email-title {
    margin: 0 0 20px;
    color: var(--el-text-color-primary);
    font-size: clamp(20px, 2vw, 24px);
    font-weight: 600;
    line-height: 1.35;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }

  .sender-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
  }

  .sender-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: #fff;
    background: var(--el-color-primary);
    font-size: 16px;
    font-weight: 600;
  }

  .sender-meta {
    min-width: 0;
  }

  .sender-primary {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
    line-height: 1.45;
  }

  .sender-address,
  .recipient-line,
  .message-time {
    color: var(--secondary-text-color);
    font-size: 12px;
  }

  .sender-address {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recipient-line {
    margin-top: 3px;
    overflow-wrap: anywhere;
  }

  .message-time {
    align-self: start;
    padding-top: 3px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    .sender-row {
      grid-template-columns: 36px minmax(0, 1fr);
    }
    .sender-avatar {
      width: 36px;
      height: 36px;
    }
    .message-time {
      grid-column: 2;
      padding-top: 0;
    }
    .sender-primary {
      display: grid;
      gap: 1px;
    }
  }

  .content {
    display: flex;
    flex-direction: column;

    .att {
      margin-top: 30px;
      margin-bottom: 30px;
      border: 1px solid var(--light-border-color);
      padding: 14px;
      border-radius: 6px;
      width: fit-content;
      .att-box {
        min-width: min(410px,calc(100vw - 60px));
        max-width: 600px;
        display: grid;
        gap: 12px;
        grid-template-rows: 1fr;
      }

      .att-title {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        span:first-child {
          font-weight: bold;
        }
      }

      .att-item {
        cursor: pointer;
        div {
          align-self: center;
        }
        background: var(--light-ill);
        padding: 5px 7px;
        border-radius: 4px;
        align-self: start;
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        .att-icon {
          display: grid;
        }

        .att-size {
          color: var(--secondary-text-color);
        }

        .att-name {
          margin-left: 8px;
          margin-right: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-all;
        }

        .att-image {
          width: 60px;
          height: 60px;
          object-fit: contain;
        }

        .opt-icon {
          padding-left: 10px;
          color: var(--secondary-text-color);
          align-items: center;
          display: flex;
          gap: 8px;
          cursor: pointer;
          a {
            color: var(--secondary-text-color);
            align-items: center;
            display: flex;
          }
        }
      }
    }

    .email-info {
      margin-top: 16px;

      .email-msg {
        max-width: 400px;
        width: fit-content;
        margin-bottom: 15px;
      }

    }
  }
}

.message-body {
  min-height: 360px;
  height: clamp(360px, 62vh, 720px);
  margin-top: 16px;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--light-border-color);
}

.shadow-html {
  width: 100%;
  height: 100%;
}

.email-text {
  min-height: 100%;
  padding: 20px 24px;
  color: #202124;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.bottom-distance {
  margin-bottom: 30px;
}


</style>
