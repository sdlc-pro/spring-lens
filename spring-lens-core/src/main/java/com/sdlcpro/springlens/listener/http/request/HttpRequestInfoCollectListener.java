package com.sdlcpro.springlens.listener.http.request;

import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;

@FunctionalInterface
public interface HttpRequestInfoCollectListener {
    /**
     * Callback method triggered when HttpRequestInfo is collected.
     *
     * @param httpRequestInfo the captured HTTP request/response transaction metadata
     */
    void onHttpRequestInfoCollect(HttpRequestInfo httpRequestInfo);
}
