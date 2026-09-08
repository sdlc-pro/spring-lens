class HttpClient {
    async get(endpointUrl) {
        const response = await fetch(endpointUrl);
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            throw error
        }
        return await response.json();
    }

    async getWithQuery(baseUrl, queryParams) {
        const requestUrl = `${baseUrl}?${queryParams}`;
        const response = await fetch(requestUrl);

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            throw error;
        }
        return await response.json();
    }
}

const httpClient = new HttpClient();
export default httpClient;