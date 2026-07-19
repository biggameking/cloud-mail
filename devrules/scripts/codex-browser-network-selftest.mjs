#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  cleanLegacyConfig,
  parseSystemProxy,
  renderLaunchAgent,
  renderLaunchEnvironmentSetter,
  renderNodeReplProxyWrapper,
} from './devrules-lib/codex-browser-network-core.mjs';

const proxyOutput = [
  '<dictionary> {',
  '  HTTPEnable : 1',
  '  HTTPPort : 7890',
  '  HTTPProxy : 127.0.0.1',
  '  HTTPSEnable : 1',
  '  HTTPSPort : 7890',
  '  HTTPSProxy : 127.0.0.1',
  '}',
].join('\n');

const proxy = parseSystemProxy(proxyOutput);
assert.deepEqual(proxy, {
  http: 'http://127.0.0.1:7890',
  https: 'http://127.0.0.1:7890',
});
assert.deepEqual(parseSystemProxy(proxyOutput.replaceAll('127.0.0.1', 'proxy.example.com')), {});

const paths = {
  nodeReplPath: '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl',
  wrapperPath: '/Users/test/.codex/hooks/devrules-node-repl-proxy-wrapper.zsh',
  setterPath: '/Users/test/.codex/hooks/devrules-codex-browser-launch-env.zsh',
  launchAgentPath: '/Users/test/Library/LaunchAgents/com.devrules.codex-browser-network.plist',
};

const wrapper = renderNodeReplProxyWrapper(paths);
assert.match(wrapper, /scutil --proxy/);
assert.match(wrapper, /NODE_USE_ENV_PROXY=1/);
assert.match(wrapper, /HTTP_PROXY=\$http_url/);
assert.match(wrapper, /HTTPS_PROXY=\$https_url/);
assert.match(wrapper, /BROWSER_USE_DISABLE_AMBIENT_NETWORK=1/);
assert.match(wrapper, /exec \/usr\/bin\/env/);
assert.match(wrapper, /real_node_repl='\/Applications\/ChatGPT\.app/);

const setter = renderLaunchEnvironmentSetter(paths);
assert.match(setter, /BROWSER_USE_DISABLE_AMBIENT_NETWORK 1/);
assert.match(setter, /CODEX_NODE_REPL_PATH/);
assert.doesNotMatch(setter, /HTTP_PROXY|HTTPS_PROXY|NODE_USE_ENV_PROXY/);

const launchAgent = renderLaunchAgent(paths);
assert.match(launchAgent, /com\.devrules\.codex-browser-network/);
assert.match(launchAgent, /devrules-codex-browser-launch-env\.zsh/);
assert.match(launchAgent, /<key>RunAtLoad<\/key>/);

const legacyComplete = [
  '[mcp_servers.node_repl]',
  'command = "/Applications/ChatGPT.app/node_repl"',
  '',
  '[mcp_servers.node_repl.env]',
  '# DEVRULES:CODEX-BROWSER-NETWORK-START',
  'BROWSER_USE_DISABLE_AMBIENT_NETWORK = "1"',
  'NODE_USE_ENV_PROXY = "1"',
  'HTTP_PROXY = "http://127.0.0.1:7890"',
  'HTTPS_PROXY = "http://127.0.0.1:7890"',
  'NO_PROXY = "localhost,127.0.0.1,::1"',
  '# DEVRULES:CODEX-BROWSER-NETWORK-END',
  '',
  'NODE_REPL_NODE_PATH = "/Applications/ChatGPT.app/node"',
  '',
  '[unrelated]',
  'enabled = true',
  '',
].join('\n');

const cleanedComplete = cleanLegacyConfig(legacyComplete);
assert.doesNotMatch(cleanedComplete, /DEVRULES:CODEX-BROWSER-NETWORK/);
assert.doesNotMatch(cleanedComplete, /HTTP_PROXY|HTTPS_PROXY|NODE_USE_ENV_PROXY/);
assert.match(cleanedComplete, /NODE_REPL_NODE_PATH/);
assert.match(cleanedComplete, /\[unrelated\]\nenabled = true/);

const orphanEnd = legacyComplete
  .replace('# DEVRULES:CODEX-BROWSER-NETWORK-START\n', '')
  .replace('BROWSER_USE_DISABLE_AMBIENT_NETWORK = "1"\n', '')
  .replace('NODE_USE_ENV_PROXY = "1"\n', '')
  .replace('HTTP_PROXY = "http://127.0.0.1:7890"\n', '')
  .replace('HTTPS_PROXY = "http://127.0.0.1:7890"\n', '')
  .replace('NO_PROXY = "localhost,127.0.0.1,::1"\n', '');
const cleanedOrphan = cleanLegacyConfig(orphanEnd);
assert.doesNotMatch(cleanedOrphan, /DEVRULES:CODEX-BROWSER-NETWORK/);
assert.match(cleanedOrphan, /NODE_REPL_NODE_PATH/);

const unmanaged = [
  '[mcp_servers.node_repl]',
  'command = "node_repl"',
  '',
  '[mcp_servers.node_repl.env]',
  'HTTP_PROXY = "http://custom.example:8080"',
  '',
].join('\n');
assert.equal(cleanLegacyConfig(unmanaged), unmanaged);

process.stdout.write('codex browser network selftest: PASS\n');
