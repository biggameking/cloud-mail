export const LABEL = 'com.devrules.codex-browser-network';
export const AMBIENT_KEY = 'BROWSER_USE_DISABLE_AMBIENT_NETWORK';
export const NODE_REPL_OVERRIDE_KEY = 'CODEX_NODE_REPL_PATH';
export const LEGACY_MARKERS = [
  '# DEVRULES:CODEX-BROWSER-NETWORK-START',
  '# DEVRULES:CODEX-BROWSER-NETWORK-END',
];
const LEGACY_KEYS = new Set([
  AMBIENT_KEY,
  'NODE_USE_ENV_PROXY',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
]);
export const DEFAULT_NODE_REPL = '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl';

function valueFor(raw, key) {
  return raw.match(new RegExp('^\\s*' + key + '\\s*:\\s*(.+?)\\s*$', 'm'))?.[1] || '';
}
function makeProxyUrl(host, port) {
  const normalizedHost = host.trim();
  const normalizedPort = Number.parseInt(String(port), 10);
  if (!normalizedHost || !Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) return '';
  const urlHost = normalizedHost.includes(':') ? '[' + normalizedHost + ']' : normalizedHost;
  return 'http://' + urlHost + ':' + normalizedPort;
}

function isLoopbackUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:'
      && !parsed.username
      && !parsed.password
      && (parsed.hostname === 'localhost'
        || parsed.hostname === '::1'
        || parsed.hostname === '[::1]'
        || /^127(?:\.\d{1,3}){3}$/.test(parsed.hostname));
  } catch {
    return false;
  }
}

export function parseSystemProxy(raw) {
  const endpoints = {};
  if (valueFor(raw, 'HTTPEnable') === '1') {
    const http = makeProxyUrl(valueFor(raw, 'HTTPProxy'), valueFor(raw, 'HTTPPort'));
    if (http && isLoopbackUrl(http)) endpoints.http = http;
  }
  if (valueFor(raw, 'HTTPSEnable') === '1') {
    const https = makeProxyUrl(valueFor(raw, 'HTTPSProxy'), valueFor(raw, 'HTTPSPort'));
    if (https && isLoopbackUrl(https)) endpoints.https = https;
  }
  return endpoints;
}

function shellSingleQuote(value) {
  return "'" + String(value).replaceAll("'", "'\\''") + "'";
}

export function renderNodeReplProxyWrapper(paths) {
  return [
    '#!/bin/zsh',
    'set -u',
    '',
    'real_node_repl=' + shellSingleQuote(paths.nodeReplPath),
    'if [[ ! -x "$real_node_repl" ]]; then',
    '  print -u2 "devrules browser network: bundled node_repl is unavailable"',
    '  exit 127',
    'fi',
    '',
    'proxy_output=$(/usr/sbin/scutil --proxy 2>/dev/null || true)',
    'proxy_value() {',
    "  /usr/bin/awk -v key=\"$1\" '$1 == key && $2 == \":\" { print $3; exit }' <<< \"$proxy_output\"",
    '}',
    'is_loopback() {',
    '  [[ "$1" == "localhost" || "$1" == 127.* || "$1" == "::1" ]]',
    '}',
    'proxy_url() {',
    '  local host="$1"',
    '  local port="$2"',
    '  if [[ "$host" == *:* ]]; then',
    '    print -r -- "http://[$host]:$port"',
    '  else',
    '    print -r -- "http://$host:$port"',
    '  fi',
    '}',
    '',
    'http_url=""',
    'https_url=""',
    'if [[ "$(proxy_value HTTPEnable)" == "1" ]]; then',
    '  http_host="$(proxy_value HTTPProxy)"',
    '  http_port="$(proxy_value HTTPPort)"',
    '  if is_loopback "$http_host" && [[ "$http_port" == <-> ]]; then',
    '    http_url="$(proxy_url "$http_host" "$http_port")"',
    '  fi',
    'fi',
    'if [[ "$(proxy_value HTTPSEnable)" == "1" ]]; then',
    '  https_host="$(proxy_value HTTPSProxy)"',
    '  https_port="$(proxy_value HTTPSPort)"',
    '  if is_loopback "$https_host" && [[ "$https_port" == <-> ]]; then',
    '    https_url="$(proxy_url "$https_host" "$https_port")"',
    '  fi',
    'fi',
    '',
    'typeset -a scoped_env',
    'scoped_env=(' + AMBIENT_KEY + '=1)',
    'if [[ -n "$http_url" || -n "$https_url" ]]; then',
    '  [[ -n "$http_url" ]] || http_url="$https_url"',
    '  [[ -n "$https_url" ]] || https_url="$http_url"',
    '  scoped_env+=(',
    '    NODE_USE_ENV_PROXY=1',
    '    "HTTP_PROXY=$http_url"',
    '    "HTTPS_PROXY=$https_url"',
    '    "NO_PROXY=localhost,127.0.0.1,::1"',
    '  )',
    'fi',
    '',
    'exec /usr/bin/env -u NODE_USE_ENV_PROXY -u HTTP_PROXY -u HTTPS_PROXY -u NO_PROXY "$scoped_env[@]" "$real_node_repl" "$@"',
    '',
  ].join('\n');
}

export function renderLaunchEnvironmentSetter(paths) {
  return [
    '#!/bin/zsh',
    'set -u',
    '/bin/launchctl setenv ' + AMBIENT_KEY + ' 1',
    '/bin/launchctl setenv ' + NODE_REPL_OVERRIDE_KEY + ' ' + shellSingleQuote(paths.wrapperPath),
    '',
  ].join('\n');
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function renderLaunchAgent(paths) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    '  <string>' + LABEL + '</string>',
    '  <key>ProgramArguments</key>',
    '  <array>',
    '    <string>/bin/zsh</string>',
    '    <string>' + xmlEscape(paths.setterPath) + '</string>',
    '  </array>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>ProcessType</key>',
    '  <string>Background</string>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

function nodeReplEnvBounds(lines) {
  const start = lines.findIndex((line) => line.trim() === '[mcp_servers.node_repl.env]');
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

export function cleanLegacyConfig(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.replace(/\n$/, '').split('\n');
  const bounds = nodeReplEnvBounds(lines);
  if (!bounds) return normalized.endsWith('\n') ? normalized : normalized + '\n';
  const body = lines.slice(bounds.start + 1, bounds.end);
  const hasMarker = body.some((line) => LEGACY_MARKERS.includes(line.trim()));
  if (!hasMarker) return normalized.endsWith('\n') ? normalized : normalized + '\n';
  const cleanedBody = body.filter((line) => {
    if (LEGACY_MARKERS.includes(line.trim())) return false;
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    return !key || !LEGACY_KEYS.has(key);
  });
  while (cleanedBody[0] !== undefined && cleanedBody[0].trim() === '') cleanedBody.shift();
  const next = [
    ...lines.slice(0, bounds.start + 1),
    ...(cleanedBody.length > 0 ? ['', ...cleanedBody] : []),
    ...lines.slice(bounds.end),
  ];
  return next.join('\n').replace(/\n+$/, '') + '\n';
}
