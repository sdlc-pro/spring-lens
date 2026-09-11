import httpClient from '../helper/http-client.js';
import TemplateEngine from '../helper/template-engine.js';

export class ApplicationState {
    constructor({healthApi, infoApi}) {
        this.healthApi = healthApi;
        this.infoApi = infoApi;

        this.container = "#sidebar-status-container";
        this.intervalMs = 10000;

        this.isLive = null;
        this.appInfo = null;
        this.appName = null;
        this.timer = null;
        this.stateListeners = [];
        this.appInfoListeners = [];
        this._appInfoPromise = null;
        this._visibilityHandler = null;
    }

    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateListeners.push(callback);
            if (this.isLive !== null) {
                try { callback(this.isLive); } catch (e) { console.error('Error in state listener:', e); }
            }
            return () => {
                this.stateListeners = this.stateListeners.filter(fn => fn !== callback);
            };
        }
        return () => {};
    }

    onAppInfoChange(callback) {
        if (typeof callback === 'function') {
            this.appInfoListeners.push(callback);
            if (this.appInfo !== null) {
                try { callback(this.appInfo); } catch (e) { console.error('Error in app info listener:', e); }
            }
            return () => {
                this.appInfoListeners = this.appInfoListeners.filter(fn => fn !== callback);
            };
        }
        return () => {};
    }

    setAppInfo(info) {
        if (!info || typeof info !== 'object') return;
        this.appInfo = info;
        if (info.name) {
            this.appName = info.name;
        }

        this.appInfoListeners.forEach(fn => {
            try { fn(info); } catch (e) { console.error('Error in appInfo listener:', e); }
        });
    }

    getAppName() {
        return this.appName || 'SpringLens';
    }

    getAppInfo() {
        return this.appInfo;
    }

    async fetchAppInfo(force = false) {
        if (!force && this.appInfo) {
            return this.appInfo;
        }
        if (!force && this._appInfoPromise) {
            return this._appInfoPromise;
        }
        if (!this.infoApi) {
            return null;
        }

        this._appInfoPromise = httpClient.get(this.infoApi)
            .then(data => {
                this.setAppInfo(data);
                return data;
            })
            .catch(err => {
                console.warn('[ApplicationState] Could not fetch application info:', err);
                return null;
            })
            .finally(() => {
                this._appInfoPromise = null;
            });

        return this._appInfoPromise;
    }

    start(intervalMs) {
        if (intervalMs) this.intervalMs = intervalMs;
        
        this.checkHealth();
        if (this.infoApi) {
            this.fetchAppInfo();
        }
        
        this._startPolling();

        if (!this._visibilityHandler) {
            this._visibilityHandler = () => {
                if (document.hidden) {
                    this._stopPolling();
                } else {
                    this.checkHealth();
                    this._startPolling();
                }
            };
            document.addEventListener('visibilitychange', this._visibilityHandler);
        }
    }

    stop() {
        this._stopPolling();
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }
    }

    async checkHealth() {
        if (!this.healthApi) return false;
        try {
            const data = await httpClient.get(this.healthApi);
            const status = (data?.status || '').toLowerCase();
            const isLive = status === 'up';
            this.render(isLive);
            return isLive;
        } catch (error) {
            this.render(false);
            return false;
        }
    }

    render(isLive) {
        if (this.isLive === isLive) return;
        this.isLive = isLive;

        const templateId = isLive ? 'tpl-status-connected' : 'tpl-status-disconnected';
        const clone = TemplateEngine.clone(templateId);
        if (clone) {
            $(this.container).empty().append(clone);
        }

        this.stateListeners.forEach(fn => {
            try { fn(isLive); } catch (e) { console.error('Error in state listener:', e); }
        });
    }

    _startPolling() {
        this._stopPolling();
        this.timer = setInterval(() => this.checkHealth(), this.intervalMs);
    }

    _stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

export default ApplicationState;