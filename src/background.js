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

const staticExtensions = /\.(jpg|jpeg|png|gif|webp|js|css|woff2?|ttf|svg|ico)$/i;
const mediaExtensions = /\.(mp4|m4s)$/i;
const staticResourceTypes = new Set([
	'image',
	'imageset',
	'font',
	'stylesheet',
	'script',
	'web_manifest',
	'object',
	'object_subrequest'
]);
const mediaResourceTypes = new Set(['media']);

const LOG_LEVEL_RANK = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
	trace: 4
};
const DEFAULT_LOG_LEVEL = 'warn';
const REQUEST_CONTEXT_LIMIT = 2000;
const requestContexts = new Map();
let debugLogWriteQueue = [];
let debugLogWriteInProgress = false;

const EVENT_LOG_LEVELS = new Map([
	['proxy_error', 'error'],
	['proxy_test_start', 'debug'],
	['proxy_test_join', 'debug'],
	['proxy_test_result', 'info'],
	['proxy_test_request', 'trace'],
	['keep_alive_start', 'info'],
	['keep_alive_stop', 'info'],
	['keep_alive_skip', 'debug'],
	['keep_alive_result', 'info'],
	['tab_track', 'trace'],
	['tab_untrack', 'trace'],
	['request_decision', 'debug'],
	['request_started', 'trace'],
	['request_response', 'debug'],
	['request_completed', 'info'],
	['request_failed', 'error'],
	['proxy_auth_required', 'debug']
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

function normalizeLogLevel(level) {
	return Object.prototype.hasOwnProperty.call(LOG_LEVEL_RANK, level)
		? level
		: DEFAULT_LOG_LEVEL;
}

function getDefaultEventLogLevel(event, details) {
	if (
		(details && details.success === false)
		&& (event === 'proxy_test_result' || event === 'keep_alive_result')
	) {
		return 'warn';
	}
	return EVENT_LOG_LEVELS.get(event) || DEFAULT_LOG_LEVEL;
}

function isLogLevelVisible(level, configuredLevel) {
	return LOG_LEVEL_RANK[normalizeLogLevel(level)]
		<= LOG_LEVEL_RANK[normalizeLogLevel(configuredLevel)];
}

function getSafeUrlDetails(url) {
	try {
		const urlObj = new URL(url);
		return {
			hostname: urlObj.hostname,
			pathname: urlObj.pathname
		};
	} catch (err) {
		return {
			hostname: '',
			pathname: ''
		};
	}
}

function rememberRequestContext(requestId, context) {
	if (!requestId) {
		return;
	}

	if (!requestContexts.has(requestId) && requestContexts.size >= REQUEST_CONTEXT_LIMIT) {
		const oldestRequestId = requestContexts.keys().next().value;
		requestContexts.delete(oldestRequestId);
	}
	requestContexts.set(requestId, {
		...requestContexts.get(requestId),
		...context
	});
}

function getRequestContext(requestId) {
	return requestContexts.get(requestId) || {};
}

function forgetRequestContext(requestId) {
	if (requestId) {
		requestContexts.delete(requestId);
	}
}

function getRequestLifecycleDetails(requestDetails) {
	const context = getRequestContext(requestDetails.requestId);
	const safeUrl = getSafeUrlDetails(requestDetails.url);
	const proxyInfo = requestDetails.proxyInfo || {};

	return {
		requestId: requestDetails.requestId,
		tabId: requestDetails.tabId,
		method: requestDetails.method,
		resourceType: requestDetails.type,
		hostname: safeUrl.hostname,
		pathname: safeUrl.pathname,
		route: context.route || (requestDetails.proxyInfo ? 'proxy' : 'unknown'),
		decisionReason: context.decisionReason || null,
		proxyType: context.proxyType || proxyInfo.type || null,
		proxyHost: context.proxyHost || proxyInfo.host || null
	};
}

function flushDebugLogQueue() {
	if (debugLogWriteInProgress || debugLogWriteQueue.length === 0) {
		return;
	}

	debugLogWriteInProgress = true;
	const pendingEntries = debugLogWriteQueue.splice(0);
	bgBrowserCtx.storage.local.get({ debugLogs: [] }, item => {
		const logs = Array.isArray(item.debugLogs) ? item.debugLogs : [];
		logs.push(...pendingEntries);
		bgBrowserCtx.storage.local.set({ debugLogs: logs.slice(-DEBUG_LOG_LIMIT) }, () => {
			debugLogWriteInProgress = false;
			flushDebugLogQueue();
		});
	});
}

function writeDebugLog(event, details = {}, level) {
	const settings = this.settings.get();
	const entryLevel = normalizeLogLevel(level || getDefaultEventLogLevel(event, details));
	const entry = {
		time: new Date().toISOString(),
		event,
		level: entryLevel,
		state: {
			switchRegion: settings.switchRegion,
			keepAlive: settings.keepAlive,
			notifyProxyErrors: settings.notifyProxyErrors,
			proxyCustom: settings.proxyCustom,
			customProxyStatic: Boolean(settings.customProxyStatic),
			customProxyMedia: Boolean(settings.customProxyMedia),
			activeCrunchyrollTabs: activeCrunchyrollTabs.size,
			proxyTestsInProgress
		},
		details
	};

	// Capture every event in the existing bounded local buffer. The selected level
	// controls console visibility and dashboard filtering, not event generation.
	if (isLogLevelVisible(entryLevel, settings.logLevel)) {
		console.log('CR-Unblocker debug', entry);
	}
	debugLogWriteQueue.push(entry);
	flushDebugLogQueue();
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

function getRoutingDecision(requestInfo, pathname, settings) {
	const isMedia = mediaResourceTypes.has(requestInfo.type) || mediaExtensions.test(pathname);
	const isStatic = staticResourceTypes.has(requestInfo.type) || staticExtensions.test(pathname);

	if (isMedia && !settings.customProxyMedia) {
		return { proxy: false, reason: 'media_direct_by_setting' };
	}
	if (isStatic && !settings.customProxyStatic) {
		return { proxy: false, reason: 'static_direct_by_setting' };
	}

	return { proxy: true, reason: 'dynamic_request' };
}

async function handleProxyRequest(requestInfo) {
	const requestId = requestInfo.requestId;
	const safeUrl = getSafeUrlDetails(requestInfo.url);
	const baseDetails = {
		requestId,
		resourceType: requestInfo.type,
		hostname: safeUrl.hostname,
		pathname: safeUrl.pathname
	};

	let urlObj;
	try {
		urlObj = new URL(requestInfo.url);
	} catch (err) {
		rememberRequestContext(requestId, {
			route: 'direct',
			decisionReason: 'invalid_url'
		});
		writeDebugLog('request_decision', {
			...baseDetails,
			decision: 'direct',
			reason: 'invalid_url'
		}, 'warn');
		return;
	}

	const hostname = urlObj.hostname;
	const pathname = urlObj.pathname;

	const isBypassDomain = bypassDomains.some(domain =>
		hostname === domain || hostname.endsWith(`.${domain}`)
	);

	if (isBypassDomain) {
		rememberRequestContext(requestId, {
			route: 'direct',
			decisionReason: 'bypass_domain'
		});
		writeDebugLog('request_decision', {
			...baseDetails,
			decision: 'direct',
			reason: 'bypass_domain'
		}, 'debug');
		return
	}

	const settings = this.settings.get();

	if (!settings.switchRegion) {
		rememberRequestContext(requestId, {
			route: 'direct',
			decisionReason: 'region_switch_disabled'
		});
		writeDebugLog('request_decision', {
			...baseDetails,
			decision: 'direct',
			reason: 'region_switch_disabled'
		}, 'info');
		return
	}

	const routingDecision = getRoutingDecision(requestInfo, pathname, settings);
	if (!routingDecision.proxy) {
		rememberRequestContext(requestId, {
			route: 'direct',
			decisionReason: routingDecision.reason
		});
		writeDebugLog('request_decision', {
			...baseDetails,
			decision: 'direct',
			reason: routingDecision.reason
		}, 'debug');
		return;
	}

	const proxyConfig = await getProxyConfig(settings)
	rememberRequestContext(requestId, {
		route: 'proxy',
		decisionReason: routingDecision.reason,
		proxyType: proxyConfig.type,
		proxyHost: proxyConfig.host
	});
	writeDebugLog('request_decision', {
		...baseDetails,
		decision: 'proxy',
		reason: routingDecision.reason,
		proxyType: proxyConfig.type,
		proxyHost: proxyConfig.host,
		proxyPort: proxyConfig.port
	}, 'info');
	return [proxyConfig, { type: 'direct' }]
}

bgBrowserCtx.proxy.onRequest.addListener(
	handleProxyRequest,
	{ urls: ['*://*.crunchyroll.com/*'] }
)
bgBrowserCtx.webRequest.onAuthRequired.addListener(
	(details) => {
		const settings = this.settings.get();
		writeDebugLog('proxy_auth_required', {
			requestId: details.requestId,
			proxyType: settings.proxyType,
			usernameConfigured: Boolean(settings.proxyUser),
			isProxy: Boolean(details.isProxy)
		}, 'debug');
		if (settings.proxyType !== 'http' && settings.proxyType !== 'https') {
			return {};
		}
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

bgBrowserCtx.webRequest.onBeforeRequest.addListener(
	details => {
		const startedAt = Date.now();
		const proxyInfo = details.proxyInfo || {};
		rememberRequestContext(details.requestId, {
			startedAt,
			route: getRequestContext(details.requestId).route
				|| (details.proxyInfo ? 'proxy' : 'unknown'),
			proxyType: getRequestContext(details.requestId).proxyType || proxyInfo.type || null,
			proxyHost: getRequestContext(details.requestId).proxyHost || proxyInfo.host || null
		});
		writeDebugLog('request_started', {
			...getRequestLifecycleDetails(details),
			startedAt
		}, 'trace');
	},
	{ urls: ['*://*.crunchyroll.com/*'] }
);

bgBrowserCtx.webRequest.onHeadersReceived.addListener(
	details => {
		const statusCode = Number(details.statusCode) || 0;
		writeDebugLog('request_response', {
			...getRequestLifecycleDetails(details),
			statusCode
		}, statusCode >= 400 ? 'warn' : 'debug');
	},
	{ urls: ['*://*.crunchyroll.com/*'] }
);

bgBrowserCtx.webRequest.onCompleted.addListener(
	details => {
		const context = getRequestContext(details.requestId);
		const statusCode = Number(details.statusCode) || 0;
		const durationMs = context.startedAt ? Math.max(0, Date.now() - context.startedAt) : null;
		writeDebugLog('request_completed', {
			...getRequestLifecycleDetails(details),
			statusCode,
			durationMs
		}, statusCode >= 400 ? 'warn' : 'info');
		forgetRequestContext(details.requestId);
	},
	{ urls: ['*://*.crunchyroll.com/*'] }
);

bgBrowserCtx.webRequest.onErrorOccurred.addListener(
	details => {
		const context = getRequestContext(details.requestId);
		const durationMs = context.startedAt ? Math.max(0, Date.now() - context.startedAt) : null;
		writeDebugLog('request_failed', {
			...getRequestLifecycleDetails(details),
			error: details.error,
			durationMs
		}, 'error');
		forgetRequestContext(details.requestId);
	},
	{ urls: ['*://*.crunchyroll.com/*'] }
);

bgBrowserCtx.proxy.onError.addListener(error => {
	const settings = this.settings.get();
	writeDebugLog('proxy_error', {
		message: error.message,
		name: error.name,
		fileName: error.fileName,
		lineNumber: error.lineNumber,
		duringProxyTest: proxyTestsInProgress > 0,
		notifyProxyErrors: settings.notifyProxyErrors
	}, 'error');
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
		const safeUrl = getSafeUrlDetails(requestInfo.url);
		writeDebugLog('proxy_test_request', {
			resourceType: requestInfo.type,
			hostname: safeUrl.hostname,
			pathname: safeUrl.pathname,
			proxyType: proxy.type,
			proxyHost: proxy.host,
			proxyPort: proxy.port
		}, 'trace');

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
		writeDebugLog('keep_alive_start', {
			activeCrunchyrollTabs: activeCrunchyrollTabs.size
		});
		scheduleKeepAliveProxyStatus(0);
	} else if (!shouldKeepAlive && proxyStatusTimer) {
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
			writeDebugLog('keep_alive_skip', {
				reason: 'proxy_test_in_progress',
				inProgress: proxyTestsInProgress
			})
		} else {
			const proxyConfig = await getProxyConfig(settings)
			await testProxyConfig(proxyConfig, result => {
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
