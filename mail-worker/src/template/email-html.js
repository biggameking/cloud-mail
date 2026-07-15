export default function emailHtmlTemplate(html) {
	const sandboxDocument = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; object-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;padding:8px;background:#fff;color:#13181d;font:14px/1.5 system-ui,sans-serif;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${html || ''}</body></html>`;
	const safeSandboxJson = JSON.stringify(sandboxDocument).replace(/</g, '\\u003C');

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
	<title>Email preview</title>
	<style>html,body,iframe{box-sizing:border-box;margin:0;width:100%;height:100%;border:0;background:#fff}</style>
</head>
<body>
	<iframe id="preview" sandbox="" referrerpolicy="no-referrer" title="Email content"></iframe>
	<script>
		document.getElementById('preview').srcdoc = ${safeSandboxJson};
	</script>
</body>
</html>`;
}
