export default class QueryParam {

    static build(rawParams) {
        if (!rawParams) return new URLSearchParams();
        if (rawParams instanceof URLSearchParams) return rawParams;
        if (typeof rawParams === 'string') {
            const queryStr = rawParams.startsWith('?') ? rawParams.slice(1) : rawParams;
            return new URLSearchParams(queryStr);
        }

        const cleanEntries = Object.entries(rawParams).filter(
            ([_, value]) =>
                value !== ''
                && value !== null
                && value !== undefined);

        return new URLSearchParams(cleanEntries);
    }

    static parse(params) {
        if (params instanceof URLSearchParams) return params;
        if (typeof params === 'string') {
            const queryStr = params.includes('?') ? params.split('?')[1] : params;
            return new URLSearchParams(queryStr);
        }
        const hash = window.location.hash || '';
        const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
        return new URLSearchParams(hashQuery);
    }

    static get(params, ...keys) {
        const searchParams = this.parse(params);
        for (const key of keys) {
            const val = searchParams.get(key);
            if (val !== null && val !== undefined && val !== '') {
                return val;
            }
        }
        return null;
    }

    static append(url, params) {
        if (!params) return url;
        const query = this.build(params).toString();
        if (!query) return url;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${query}`;
    }
}
