const settingBrowserCtx = window.browser || window.chrome;

/**
 * Export function
 * @param {Object} global The Object that should receive the exported functions.
 */
((global) => {
	const logLevels = ['error', 'warn', 'info', 'debug', 'trace'];
	// Settings object with default settings
	let settings = {
		switchRegion: true,
		keepAlive: false,
		notifyProxyErrors: true,
		debugLog: false,
		logLevel: 'warn',
		logLevelExplicit: false,
		proxyCustom: false,
		customProxyStatic: false,
		customProxyMedia: false,
		proxyHost: '',
		proxyPort: 1080,
		proxyUser: '',
		proxyPass: '',
		proxyType: 'socks'
	}
	const validSettings = Object.keys(settings);

	/**
	 * Load saved settings
	 */
	settingBrowserCtx.storage.local.get({ settings: null }, (item) => {
		if (item.settings !== null) {
			// Merge saved settings with default settings overwriting the default ones
			settings = Object.assign(settings, item.settings);
			if (!logLevels.includes(settings.logLevel)) {
				settings.logLevel = 'warn';
			}
			if (typeof settings.logLevelExplicit !== 'boolean') {
				settings.logLevelExplicit = false;
			}
			if (!settings.logLevelExplicit && settings.logLevel === 'info') {
				settings.logLevel = 'warn';
			}
			if (typeof settings.customProxyStatic !== 'boolean') {
				settings.customProxyStatic = false;
			}
			if (typeof settings.customProxyMedia !== 'boolean') {
				settings.customProxyMedia = false;
			}
		} else {
			// Save default settings
			settingBrowserCtx.storage.local.set({ settings: settings });
		}
	});

	/**
	 * Saves settings validating keys and sending an update message
	 * @param  {Object} keys Object containing the settings to change
	 */
	function saveSettings(keys) {
		const changed = {};
		for (const key of Object.keys(keys)) {
			if (
				validSettings.includes(key)
				&& (key !== 'logLevel' || logLevels.includes(keys[key]))
				&& (key !== 'logLevelExplicit' || typeof keys[key] === 'boolean')
				&& (key !== 'customProxyStatic' || typeof keys[key] === 'boolean')
				&& (key !== 'customProxyMedia' || typeof keys[key] === 'boolean')
			) {
				// Update settings object
				settings[key] = keys[key];
				changed[key] = keys[key];
			}
		}
		if (Object.prototype.hasOwnProperty.call(keys, 'logLevel')) {
			settings.logLevelExplicit = true;
			changed.logLevelExplicit = true;
		}
		settingBrowserCtx.runtime.sendMessage({ event: 'settingsChanged', changed: changed, settings: settings });
		settingBrowserCtx.storage.local.set({ settings: settings });
	}

	/**
	 * Gets settings as copy
	 * @return {Object} Object containing settings
	 */
	function getSettings() {
		return Object.assign({}, settings);
	}

	if (!global.settings) {
		global.settings = {
			save: saveSettings,
			get: getSettings
		};
	}
})(this || {});

/**
 * Export object through messages
 */
settingBrowserCtx.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === 'saveSettings') {
		this.settings.save(message.settings);
	} else if (message.action === 'getSettings') {
		sendResponse(this.settings.get());
	}
});
