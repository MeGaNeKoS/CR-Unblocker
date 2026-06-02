const bgBrowserCtx = window.browser || window.chrome

const DEFAULT_PROXY_CONFIG = {
	type: 'socks',
	proxyDNS: true,
	host: 'us.community-proxy.meganeko.dev',
	port: 5445,
	username: 'GeoBypassCommunity-US',
	password: 'UseWithRespect',
	failoverTimeout: 3
}

let proxyTestsInProgress = 0
let proxyTestError = null
let proxyTestInFlight = null
let proxyTestInFlightKey = null

let proxyStatusTimer = null
let proxyStatusRunning = false
let activeCrunchyrollTabs = new Set();
const DEBUG_LOG_LIMIT = 5000;
const MANUAL_PROXY_TEST_TIMEOUT = 60000;
const KEEP_ALIVE_PROXY_TEST_TIMEOUT = 60000;
const SLOW_PROXY_TEST_THRESHOLD = 5000;
const KEEP_ALIVE_INTERVAL = 15000;

const bypassDomains = [
	'static.crunchyroll.com',
	'metrics.crunchyroll.com',
	'eec.crunchyroll.com'
];

const staticExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|m4s|js|css|woff2?|ttf|svg|ico|json|xml)$/i;
const staticResourceTypes = new Set([
	'image',
	'imageset',
	'font',
	'stylesheet',
	'script',
	'media',
	'web_manifest',
	'object',
	'object_subrequest'
]);

function isCrunchyrollUrl(url) {
	try {
		const hostname = new URL(url).hostname;
		return hostname === 'crunchyroll.com' || hostname.endsWith('.crunchyroll.com');
	} catch (err) {
		return false;
	}
}

function getHostname(url) {
	try {
		return new URL(url).hostname;
	} catch (err) {
		return '';
	}
}

function writeDebugLog(event, details = {}) {
	const settings = this.settings.get();
	if (!settings.debugLog) {
		return;
	}

	const entry = {
		time: new Date().toISOString(),
		event,
		state: {
			switchRegion: settings.switchRegion,
			keepAlive: settings.keepAlive,
			notifyProxyErrors: settings.notifyProxyErrors,
			proxyCustom: settings.proxyCustom,
			activeCrunchyrollTabs: activeCrunchyrollTabs.size,
			proxyTestsInProgress
		},
		details
	};

	console.log('CR-Unblocker debug', entry);
	bgBrowserCtx.storage.local.get({ debugLogs: [] }, item => {
		const logs = Array.isArray(item.debugLogs) ? item.debugLogs : [];
		logs.push(entry);
		bgBrowserCtx.storage.local.set({ debugLogs: logs.slice(-DEBUG_LOG_LIMIT) });
	});
}

async function getProxyConfig(settings) {
	if (settings.proxyCustom) {
		return {
			type: settings.proxyType,
			proxyDNS: settings.proxyType !== 'http',
			host: settings.proxyHost,
			port: settings.proxyPort,
			username: settings.proxyUser || '',
			password: settings.proxyPass || '',
			failoverTimeout: 3
		}
	}
	return { ...DEFAULT_PROXY_CONFIG }
}

async function handleProxyRequest(requestInfo) {
	if (staticResourceTypes.has(requestInfo.type)) {
		// Skip static resources
		return
	}

	const urlObj = new URL(requestInfo.url);
	const hostname = urlObj.hostname;
	const pathname = urlObj.pathname;

	const isBypass = staticExtensions.test(pathname)
			|| bypassDomains.some(domain =>
				hostname === domain || hostname.endsWith(`.${domain}`)
			);

	if (isBypass) {
		return
	}

	const settings = this.settings.get();

	if (!settings.switchRegion) {
		console.log('Region switching disabled')
		return
	}

	const proxyConfig = await getProxyConfig(settings)
	console.log(`Using ${proxyConfig.type} proxy for ${requestInfo.url} -> ${proxyConfig.host}:${proxyConfig.port}`)
	return [proxyConfig, { type: 'direct' }]
}

bgBrowserCtx.proxy.onRequest.addListener(
	handleProxyRequest,
	{ urls: ['*://*.crunchyroll.com/*'] }
)
bgBrowserCtx.webRequest.onAuthRequired.addListener(
	() => {
		const settings = this.settings.get();
		console.log(`Using ${settings.proxyType} proxy for authentication`)
		if (settings.proxyType !== 'http' && settings.proxyType !== 'https') {
			return {};
		}
		console.log(`Auth as ${settings.proxyUser} with password ${settings.proxyPass}`)
		return {
			authCredentials: {
				username: settings.proxyUser || '',
				password: settings.proxyPass || ''
			}
		};
	},
	{ urls: ['*://*.crunchyroll.com/*'] },
	['blocking']
);

bgBrowserCtx.proxy.onError.addListener(error => {
	console.error(`Proxy error: ${error.message}`)
	const settings = this.settings.get();
	writeDebugLog('proxy_error', {
		message: error.message,
		name: error.name,
		fileName: error.fileName,
		lineNumber: error.lineNumber,
		duringProxyTest: proxyTestsInProgress > 0,
		notifyProxyErrors: settings.notifyProxyErrors
	});
	if (proxyTestsInProgress > 0) {
		proxyTestError = error.message
	} else if (settings.notifyProxyErrors) {
		bgBrowserCtx.notifications.create('proxy-error', {
			type: 'basic',
			iconUrl: bgBrowserCtx.runtime.getURL('icons/Crunchyroll-128.png'),
			title: 'CR-Unblocker encountered an error!',
			message: error.message
		})
	}
})

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeout)
	options.signal = controller.signal

	try {
		return await fetch(url, options)
	} finally {
		clearTimeout(timer)
	}
}

async function testProxyConfig(proxy, sendResult, timeout = MANUAL_PROXY_TEST_TIMEOUT) {
	const proxyTestKey = `${proxy.type}:${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.proxyDNS !== false}:${timeout}`;

	if (proxyTestInFlight && proxyTestInFlightKey === proxyTestKey) {
		writeDebugLog('proxy_test_join', {
			type: proxy.type,
			host: proxy.host,
			port: proxy.port
		})
		const result = await proxyTestInFlight;
		sendResult({ ...result, proxy: `${proxy.host}:${proxy.port}` })
		return
	}

	proxyTestsInProgress += 1
	proxyTestError = null
	const startedAt = Date.now();
	writeDebugLog('proxy_test_start', {
		type: proxy.type,
		host: proxy.host,
		port: proxy.port,
		timeout,
		inProgress: proxyTestsInProgress
	});

	function testProxyHandler(requestInfo) {
		console.log(`Testing ${proxy.type} proxy for ${requestInfo.url} -> ${proxy.host}:${proxy.port}`)

		return {
			type: proxy.type,
			host: proxy.host,
			port: parseInt(proxy.port, 10),
			username: proxy.username,
			password: proxy.password,
			proxyDNS: proxy.type !== 'http',
			failoverTimeout: 3
		}
	}

	bgBrowserCtx.proxy.onRequest.addListener(
		testProxyHandler,
		{ urls: ['https://static.crunchyroll.com/config/cx-web/config.json'] }
	)

	const runProxyTest = async() => {
		try {
			const res = await fetchWithTimeout('https://static.crunchyroll.com/config/cx-web/config.json', { method: 'HEAD', cache: 'no-store' }, timeout)
			const durationMs = Date.now() - startedAt;
			let result
			if (proxyTestError) {
				result = { success: false, error: proxyTestError, durationMs }
			} else if (res.ok) {
				result = {
					success: true,
					slow: durationMs > SLOW_PROXY_TEST_THRESHOLD,
					durationMs
				}
			} else {
				result = { success: false, error: `HTTP error: ${res.status}`, durationMs }
			}
			writeDebugLog('proxy_test_result', result)
			return result
		} catch (err) {
			const durationMs = Date.now() - startedAt;
			const userError = proxyTestError
      || (err.name === 'AbortError' ? `Connection timed out (proxy did not respond within ${timeout / 1000} seconds)` : err.message)
			const result = {
				success: false,
				error: userError,
				durationMs
			}
			writeDebugLog('proxy_test_result', result)
			return result
		}
	}

	proxyTestInFlightKey = proxyTestKey;
	proxyTestInFlight = runProxyTest();

	try {
		const result = await proxyTestInFlight;
		sendResult({ ...result, proxy: `${proxy.host}:${proxy.port}` })
	} finally {
		proxyTestsInProgress = Math.max(0, proxyTestsInProgress - 1)
		proxyTestInFlight = null
		proxyTestInFlightKey = null
		bgBrowserCtx.proxy.onRequest.removeListener(testProxyHandler)
	}
}

bgBrowserCtx.runtime.onMessage.addListener(async(message) => {
	if (
		message.action === 'saveSettings'
		&& (
			Object.prototype.hasOwnProperty.call(message.settings, 'switchRegion')
			|| Object.prototype.hasOwnProperty.call(message.settings, 'keepAlive')
		)
	) {
		setTimeout(maybeUpdateProxyKeepAlive, 0);
	}

	if (message.action === 'testCustomProxy') {
		await testProxyConfig(message.proxy, result => {
			bgBrowserCtx.runtime.sendMessage({ event: 'customProxyTestResult', ...result })
		})
		return true
	}

	if (message.action === 'testCurrentProxy') {
		const currentSettings = this.settings.get()
		const proxyConfig = await getProxyConfig(currentSettings)
		await testProxyConfig(proxyConfig, result => {
			bgBrowserCtx.runtime.sendMessage({ event: 'proxyTestResult', ...result })
		})

		return true
	}
})


function maybeUpdateProxyKeepAlive() {
	const settings = this.settings.get();
	const shouldKeepAlive = settings.switchRegion && settings.keepAlive && activeCrunchyrollTabs.size > 0;

	if (shouldKeepAlive && !proxyStatusTimer && !proxyStatusRunning) {
		console.log('Starting keep-alive pings');
		writeDebugLog('keep_alive_start', {
			activeCrunchyrollTabs: activeCrunchyrollTabs.size
		});
		scheduleKeepAliveProxyStatus(0);
	} else if (!shouldKeepAlive && proxyStatusTimer) {
		console.log('Stopping keep-alive pings');
		writeDebugLog('keep_alive_stop', {
			switchRegion: settings.switchRegion,
			keepAlive: settings.keepAlive,
			activeCrunchyrollTabs: activeCrunchyrollTabs.size
		});
		clearTimeout(proxyStatusTimer);
		proxyStatusTimer = null;
	}
}

function scheduleKeepAliveProxyStatus(delay) {
	proxyStatusTimer = setTimeout(keepAliveProxyStatus, delay);
}

async function keepAliveProxyStatus() {
	proxyStatusTimer = null;
	const settings = this.settings.get();
	const shouldKeepAlive = settings.switchRegion && settings.keepAlive && activeCrunchyrollTabs.size > 0;

	if (!shouldKeepAlive) {
		return;
	}

	proxyStatusRunning = true;
	try {
		if (proxyTestsInProgress > 0) {
			console.log('Skipping keep-alive proxy check because another proxy test is running')
			writeDebugLog('keep_alive_skip', {
				reason: 'proxy_test_in_progress',
				inProgress: proxyTestsInProgress
			})
		} else {
			const proxyConfig = await getProxyConfig(settings)
			await testProxyConfig(proxyConfig, result => {
				console.log(`Keep alive proxy: ${result.success ? 'Success' : 'Failure'}`)
				writeDebugLog('keep_alive_result', result)
			}, KEEP_ALIVE_PROXY_TEST_TIMEOUT)
		}
	} finally {
		const currentSettings = this.settings.get();
		proxyStatusRunning = false;
		maybeUpdateProxyKeepAlive();
		if (
			!proxyStatusTimer
			&& currentSettings.switchRegion
			&& currentSettings.keepAlive
			&& activeCrunchyrollTabs.size > 0
		) {
			scheduleKeepAliveProxyStatus(KEEP_ALIVE_INTERVAL);
		}
	}
}

/*
 * Query all active Crunchyroll tabs when the extension loads.
 * Adds non-discarded Crunchyroll tabs to the activeCrunchyrollTabs set.
 */
bgBrowserCtx.tabs.query({ url: '*://*.crunchyroll.com/*' }).then(tabs => {
	for (const tab of tabs) {
		if (!tab.discarded) {
			activeCrunchyrollTabs.add(tab.id);
			writeDebugLog('tab_track', {
				reason: 'startup_query',
				tabId: tab.id,
				hostname: getHostname(tab.url)
			});
		}
	}
	maybeUpdateProxyKeepAlive();
});

/*
 * Listener for tab URL updates.
 * If the URL changes to a Crunchyroll page and the tab is active, add it to the set.
 * If the URL is not a Crunchyroll page or the tab is discarded, remove it from the set.
 */
bgBrowserCtx.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (isCrunchyrollUrl(tab.url) && !tab.discarded) {
		activeCrunchyrollTabs.add(tabId);
		writeDebugLog('tab_track', {
			reason: 'updated',
			tabId,
			hostname: getHostname(tab.url)
		});
	} else {
		const wasTracked = activeCrunchyrollTabs.delete(tabId);
		if (wasTracked) {
			writeDebugLog('tab_untrack', {
				reason: 'updated',
				tabId,
				hostname: getHostname(tab.url),
				discarded: Boolean(tab.discarded)
			});
		}
	}

	maybeUpdateProxyKeepAlive();
});

/*
 * Listener for when the active tab changes (user switches tabs).
 * If the new tab is a Crunchyroll page and is not discarded, add it to the set.
 */
bgBrowserCtx.tabs.onActivated.addListener(async({ tabId }) => {
	try {
		const tab = await bgBrowserCtx.tabs.get(tabId);
		if (isCrunchyrollUrl(tab.url) && !tab.discarded) {
			activeCrunchyrollTabs.add(tab.id);
			writeDebugLog('tab_track', {
				reason: 'activated',
				tabId: tab.id,
				hostname: getHostname(tab.url)
			});
		} else {
			const wasTracked = activeCrunchyrollTabs.delete(tab.id);
			if (wasTracked) {
				writeDebugLog('tab_untrack', {
					reason: 'activated',
					tabId: tab.id,
					hostname: getHostname(tab.url),
					discarded: Boolean(tab.discarded)
				});
			}
		}
		maybeUpdateProxyKeepAlive();
	} catch (err) {
		activeCrunchyrollTabs.delete(tabId);
		writeDebugLog('tab_untrack', {
			reason: 'activated_error',
			tabId,
			error: err.message
		});
		maybeUpdateProxyKeepAlive();
	}
});

/*
 * Listener for when a tab is closed.
 * If the closed tab was tracked as a Crunchyroll tab, remove it from the set.
 */
bgBrowserCtx.tabs.onRemoved.addListener((tabId) => {
	if (activeCrunchyrollTabs.has(tabId)) {
		activeCrunchyrollTabs.delete(tabId);
		writeDebugLog('tab_untrack', {
			reason: 'removed',
			tabId
		});
		maybeUpdateProxyKeepAlive();
	}
});
