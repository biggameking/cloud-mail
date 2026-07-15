<template>
  <button class="ai-monitor-icon" type="button" :title="$t(enabled ? 'aiMonitoringEnabled' : 'aiConfigureMonitoring')" @click.stop="$emit('click')">
    <Icon icon="hugeicons:ai-magic" width="18" height="18"/>
  </button>
</template>

<script setup>
import {Icon} from '@iconify/vue';

defineProps({enabled: {type: Boolean, default: false}})
defineEmits(['click'])
</script>

<style scoped>
.ai-monitor-icon {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  color: var(--el-color-primary);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: .55;
}
.ai-monitor-icon:hover,
.ai-monitor-icon:focus-visible { opacity: 1; }
</style>
