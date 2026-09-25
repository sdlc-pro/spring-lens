import QueryParam from './query-param.js';

export class HttpClient {

    constructor({ timeoutMs = 15000, headers = {} } = {}) {
        this.defaultTimeoutMs = timeoutMs;
        this.defaultHeaders = {
            'Accept': 'application/json',
            ...headers
        };
    }

    async request(url, options = {}) {
        const {
            timeout = this.defaultTimeoutMs,
            headers = {},
            signal: userSignal,
            ...fetchOptions
        } = options;

        const abortContext = this._createAbortContext(timeout, userSignal);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                headers: { ...this.defaultHeaders, ...headers },
                signal: abortContext.signal
            });

            if (!response.ok) {
                throw await this._createHttpError(response, url);
            }

            return await this._parseResponse(response);
        } catch (err) {
            if (err.name === 'AbortError' && abortContext.didTimeout()) {
                throw this._createTimeoutError(timeout, url);
            }
            throw err;
        } finally {
            abortContext.cleanup();
        }
    }

    async get(url, paramsOrOptions, options = {}) {
        if (!paramsOrOptions) {
            return this.request(url, { ...options, method: 'GET' });
        }

        const isOptions = 'timeout' in paramsOrOptions || 'headers' in paramsOrOptions || 'signal' in paramsOrOptions;
        if (isOptions && Object.keys(options).length === 0) {
            return this.request(url, { ...paramsOrOptions, method: 'GET' });
        }

        const requestUrl = QueryParam.append(url, paramsOrOptions);
        return this.request(requestUrl, { ...options, method: 'GET' });
    }

    async getWithQuery(baseUrl, queryParams, options = {}) {
        const requestUrl = QueryParam.append(baseUrl, queryParams);
        return this.request(requestUrl, { ...options, method: 'GET' });
    }

    async post(url, body = null, options = {}) {
        return this._requestWithBody('POST', url, body, options);
    }

    async put(url, body = null, options = {}) {
        return this._requestWithBody('PUT', url, body, options);
    }

    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    _createAbortContext(timeout, userSignal) {
        let timedOut = false;
        const controller = new AbortController();
        const timeoutId = timeout > 0 ? setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout) : null;

        const onUserAbort = () => controller.abort();
        if (userSignal?.aborted) {
            controller.abort();
        } else if (userSignal) {
            userSignal.addEventListener('abort', onUserAbort, { once: true });
        }

        return {
            signal: controller.signal,
            didTimeout: () => timedOut,
            cleanup: () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                userSignal?.removeEventListener('abort', onUserAbort);
            }
        };
    }

    _createTimeoutError(timeout, url) {
        const error = new Error(`Request timed out after ${timeout}ms: ${url}`);
        error.name = 'TimeoutError';
        error.status = 408;
        return error;
    }

    async _createHttpError(response, url) {
        let details = null;
        let message = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                details = await response.json();
                message = details?.message || details?.error || message;
            }
        } catch (_) {
        }

        const error = new Error(message);
        error.status = response.status;
        error.statusText = response.statusText;
        error.details = details;
        error.url = url;
        return error;
    }

    async _parseResponse(response) {
        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }

        return await response.text();
    }

    async _requestWithBody(method, url, body, options = {}) {
        const headers = { ...options.headers };
        let serializedBody = body;

        if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            serializedBody = JSON.stringify(body);
        }

        return this.request(url, {
            ...options,
            method,
            headers,
            body: serializedBody
        });
    }
}

const httpClient = new HttpClient();
export default httpClient;