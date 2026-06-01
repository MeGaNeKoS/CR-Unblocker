const browser = window.browser || window.chrome;

/**
 * Tab menu
 */
const tabLinks = document.querySelectorAll('.tabs li a');
const tabParent = document.querySelector('.tab-content');
for (const link of tabLinks) {
	const id = link.hash.substring(1);
	const tab = document.getElementById(id);
	link.addEventListener('click', () => {
		for (const item of tabLinks) {
			item.parentNode.className = '';
		}
		link.parentNode.className = 'active';
		for (const child of tabParent.children) {
			child.className = 'tab';
		}
		tab.className = 'tab active';
	});
}

/**
 * Adds event listener for checkbox that saves a settings value
 * @param {String}   id       ID of checkbox and name of setting
 * @param {Function} callback Optional callback to call with new state of setting
 */
function addSettingCheckbox(id, callback) {
	document.getElementById(id).addEventListener('change', (ev) => {
		const settings = {};
		settings[id] = ev.target.checked;
		browser.runtime.sendMessage({ action: 'saveSettings', settings });
		if (typeof callback === 'function') {
			// eslint-disable-next-line callback-return
			callback(ev.target.checked);
		}
	});
}

/**
 * Adds event listener for inputs that saves a settings value
 * @param {String}   id       ID of checkbox and name of setting
 * @param {Function} callback Optional callback to call with new state of setting
 */
function addSettingInput(id, callback) {
	document.getElementById(id).addEventListener('change', (ev) => {
		const settings = {};
		settings[id] = ev.target.value;
		browser.runtime.sendMessage({ action: 'saveSettings', settings });
		if (typeof callback === 'function') {
			// eslint-disable-next-line callback-return
			callback(ev.target.value);
		}
	});
}

/**
 * Save states
 */
addSettingCheckbox('switchRegion')
addSettingCheckbox('keepAlive')
addSettingCheckbox('notifyProxyErrors')
addSettingCheckbox('debugLog')
addSettingCheckbox('proxyCustom')
addSettingInput('proxyType')
addSettingInput('proxyHost')
addSettingInput('proxyPort')
addSettingInput('proxyUser')
addSettingInput('proxyPass')

/**
 * Display settings in DOM
 * @param  {Object} settings Settings to display
 */
function displaySettings(settings) {
	document.getElementById('switchRegion').checked = settings.switchRegion
	document.getElementById('keepAlive').checked = settings.keepAlive
	document.getElementById('notifyProxyErrors').checked = settings.notifyProxyErrors
	document.getElementById('debugLog').checked = settings.debugLog
	document.getElementById('proxyCustom').checked = settings.proxyCustom
	document.getElementById('proxyType').value = settings.proxyType || 'socks'
	document.getElementById('proxyHost').value = settings.proxyHost
	document.getElementById('proxyPort').value = settings.proxyPort
	document.getElementById('proxyUser').value = settings.proxyUser
	document.getElementById('proxyPass').value = settings.proxyPass
}

/**
 * Display settings on load
 */
browser.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
	displaySettings(settings)
	handleSwitchRegionChange(settings.switchRegion)
});

/**
 * Listen for settings update messages
 */
browser.runtime.onMessage.addListener((message) => {
	if (message.event === 'settingsChanged') {
		displaySettings(message.settings);
		handleSwitchRegionChange(message.settings.switchRegion);
	}
});

function renderDebugLog(logs) {
	const output = document.getElementById('debug-log-output');
	output.value = logs.map(entry => JSON.stringify(entry)).join('\n');
	output.scrollTop = output.scrollHeight;
}

function refreshDebugLog() {
	browser.storage.local.get({ debugLogs: [] }, item => {
		renderDebugLog(Array.isArray(item.debugLogs) ? item.debugLogs : []);
	});
}

function formatProxySuccess(message) {
	if (message.slow) {
		return `Proxy[${message.proxy}] is working but slow (${message.durationMs}ms). Your internet or the proxy may be slow.`;
	}

	return `Proxy[${message.proxy}] is working!`;
}

document.getElementById('refreshDebugLogBtn').addEventListener('click', refreshDebugLog);

document.getElementById('copyDebugLogBtn').addEventListener('click', () => {
	const output = document.getElementById('debug-log-output');
	output.select();
	document.execCommand('copy');
});

document.getElementById('downloadDebugLogBtn').addEventListener('click', () => {
	const output = document.getElementById('debug-log-output');
	const blob = new Blob([output.value], { type: 'application/x-ndjson' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	link.href = url;
	link.download = `cr-unblocker-debug-${timestamp}.jsonl`;
	link.click();
	URL.revokeObjectURL(url);
});

document.getElementById('clearDebugLogBtn').addEventListener('click', () => {
	browser.storage.local.set({ debugLogs: [] }, refreshDebugLog);
});

browser.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === 'local' && changes.debugLogs) {
		renderDebugLog(Array.isArray(changes.debugLogs.newValue) ? changes.debugLogs.newValue : []);
	}
});

refreshDebugLog();

/**
 * Test for the proxy configuration
 */
document.getElementById('testProxyBtn').addEventListener('click', () => {
	const proxyType = document.getElementById('proxyType').value;
	const proxyHost = document.getElementById('proxyHost').value;
	const proxyPort = parseInt(document.getElementById('proxyPort').value, 10);
	const proxyUser = document.getElementById('proxyUser').value;
	const proxyPass = document.getElementById('proxyPass').value;

	document.getElementById('proxyTestResult').textContent = 'Testing proxy...';

	browser.runtime.sendMessage({
		action: 'testCustomProxy',
		proxy: {
			type: proxyType,
			host: proxyHost,
			port: proxyPort,
			username: proxyUser,
			password: proxyPass
		}
	});
});

// Listen for the result
browser.runtime.onMessage.addListener((message) => {
	if (message.event === 'customProxyTestResult') {
		const output = document.getElementById('proxyTestResult');
		output.style.fontWeight = 'bold';
		output.style.padding = '8px 0';
		output.style.borderRadius = '4px';

		if (message.success) {
			output.textContent = formatProxySuccess(message);
			output.style.color = '#f78c25';
			output.style.backgroundColor = 'white';
		} else {
			output.textContent = `Proxy[${message.proxy}] failed: ${message.error}`;
			output.style.color = 'white';
			output.style.backgroundColor = '#dc7c20';
		}
	}

	if (message.event === 'proxyTestResult') {
		const output = document.getElementById('proxyStatus');

		if (message.success) {
			output.textContent = formatProxySuccess(message);
			output.style.color = '#f78c25';
			output.style.backgroundColor = 'white';
		} else {
			output.textContent = `Proxy[${message.proxy}] failed: ${message.error}`;
			output.style.color = 'white';
			output.style.backgroundColor = '#dc7c20';
		}
		finishProxyStatus();
	}
});

let proxyStatusTimer = null
let proxyStatusEnabled = false
let proxyStatusRunning = false

function testProxyStatus() {
	proxyStatusTimer = null;
	if (!proxyStatusEnabled) {
		return;
	}

	proxyStatusRunning = true;
	const statusEl = document.getElementById('proxyStatus');
	statusEl.textContent = 'Connecting...';
	statusEl.style.color = 'white';
	statusEl.style.backgroundColor = 'transparent';

	browser.runtime.sendMessage({
		action: 'testCurrentProxy'
	});
}

function scheduleProxyStatus(delay) {
	if (!proxyStatusEnabled || proxyStatusTimer || proxyStatusRunning) {
		return;
	}

	proxyStatusTimer = setTimeout(testProxyStatus, delay);
}

function finishProxyStatus() {
	proxyStatusRunning = false;
	scheduleProxyStatus(15000);
}

function handleSwitchRegionChange(enabled) {
	proxyStatusEnabled = enabled;
	if (enabled) {
		setProxyStatusSection(true);
		scheduleProxyStatus(0);
	} else {
		setProxyStatusSection(false);
		if (proxyStatusTimer) {
			clearTimeout(proxyStatusTimer);
			proxyStatusTimer = null;
		}
	}
}

function setProxyStatusSection(show) {
	const section = document.getElementById('proxyStatus');
	section.style.display = show ? 'block' : 'none';
	if (!show) {
		document.getElementById('proxyStatus').textContent = '';
	}
}

window.addEventListener('unload', () => {
	if (proxyStatusTimer) {
		clearTimeout(proxyStatusTimer)
	}
})
