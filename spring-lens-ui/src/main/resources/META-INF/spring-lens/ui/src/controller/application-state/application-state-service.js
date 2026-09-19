import httpClient from '../../helper/http-client.js';

export default class ApplicationStateService {

    _appInfoPromise = null;

    constructor({healthApi, infoApi} = {}) {
        this.healthApi = healthApi;
        this.infoApi = infoApi;
    }

    async checkHealth() {
        try {
            const data = await httpClient.get(this.healthApi);
            return (data?.status || '').toLowerCase() === 'up';
        } catch {
            return false;
        }
    }

    async fetchAppInfo() {
        if (this._appInfoPromise) return this._appInfoPromise;

        this._appInfoPromise = httpClient.get(this.infoApi)
            .catch(() => null)
            .finally(() => {
                this._appInfoPromise = null;
            });

        return this._appInfoPromise;
    }
}