<template>
  <div class="content-box" ref="contentBox">
	<iframe
	  class="content-html"
	  sandbox=""
	  referrerpolicy="no-referrer"
	  :srcdoc="safeDocument"
	  :title="$t('emailContent')"
	></iframe>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  html: {
    type: String,
    required: true
  }
})

const contentBox = ref(null)
const safeDocument = computed(() => `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; object-src 'none'; base-uri 'none'; form-action 'none'">
<style>
html{color-scheme:light;background:#fff}
body{box-sizing:border-box;margin:0;padding:20px 24px 32px;background:#fff;color:#202124;font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif;overflow-wrap:anywhere}
*,*::before,*::after{box-sizing:border-box}
img{max-width:100%!important;height:auto!important}
table{max-width:100%!important;border-collapse:collapse}
td,th{max-width:100%;vertical-align:top}
p{margin:0 0 12px}
h1,h2,h3,h4,h5,h6{margin:20px 0 10px;color:#1f2328;line-height:1.3}
a{color:#1967d2;text-decoration:none}
a:hover{text-decoration:underline}
blockquote{margin:16px 0;padding:2px 0 2px 14px;border-left:3px solid #d8dee4;color:#57606a}
pre,code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}
pre{max-width:100%;padding:12px;overflow:auto;border-radius:6px;background:#f6f8fa;white-space:pre-wrap}
hr{height:1px;margin:20px 0;border:0;background:#e5e7eb}
@media(max-width:640px){body{padding:16px 14px 24px}}
</style>
</head><body>${props.html || ''}</body></html>`)
</script>

<style scoped>
.content-box {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, Inter, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
}

.content-html {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}
</style>
