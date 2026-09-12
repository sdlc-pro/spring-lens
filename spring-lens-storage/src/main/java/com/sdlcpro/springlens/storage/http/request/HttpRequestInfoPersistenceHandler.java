package com.sdlcpro.springlens.storage.http.request;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.listener.http.request.HttpRequestInfoCollectListener;
import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;

/**
 * Persistence handler that bridges capture and storage for
 * {@link HttpRequestInfo} transactions.
 *
 * <p>This component listens for captured {@link HttpRequestInfo} events
 * via the {@link HttpRequestInfoCollectListener} callback and immediately
 * persists them using the {@link HttpRequestInfoRepository}.</p>
 *
 * @since 1.0.0
 */
@SpringLensInternalComponent
public class HttpRequestInfoPersistenceHandler implements HttpRequestInfoCollectListener {

    private final HttpRequestInfoRepository httpRequestInfoRepository;

    public HttpRequestInfoPersistenceHandler(HttpRequestInfoRepository httpRequestInfoRepository) {
        this.httpRequestInfoRepository = httpRequestInfoRepository;
    }

    @Override
    public void onHttpRequestInfoCollect(HttpRequestInfo httpRequestInfo) {
        if (httpRequestInfo != null) {
            this.httpRequestInfoRepository.save(httpRequestInfo);
        }
    }
}
