package com.sdlcpro.springlens.storage.http.request;

import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.model.http.request.HttpRequestData;
import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;
import com.sdlcpro.springlens.model.http.request.HttpResponseData;
import com.sdlcpro.springlens.model.http.request.HttpResponseStatus;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
@DisplayName("HttpRequestInfoPersistenceHandler Tests")
class HttpRequestInfoPersistenceHandlerTest {

    @Mock
    private HttpRequestInfoRepository httpRequestInfoRepository;

    @InjectMocks
    private HttpRequestInfoPersistenceHandler persistenceHandler;

    @Test
    @DisplayName("should save HttpRequestInfo exactly once when onHttpRequestInfoCollect is called")
    void shouldSaveHttpRequestInfoWhenCollected() {
        HttpRequestData requestData = new HttpRequestData(
                HttpRequestMethod.GET, "/api/orders", Map.of(), "HTTP/1.1",
                "application/json", 0, "127.0.0.1", List.of(), null);
        HttpResponseData responseData = new HttpResponseData(
                HttpResponseStatus.OK, "application/json", 0, List.of(), null);
        HttpRequestInfo httpRequestInfo = new HttpRequestInfo(
                "4bf92f3577b34da6a3ce929d0e0e4736", requestData, responseData, Instant.now(), 1000L,
                false, false, null);

        persistenceHandler.onHttpRequestInfoCollect(httpRequestInfo);

        verify(httpRequestInfoRepository, times(1)).save(httpRequestInfo);
        verifyNoMoreInteractions(httpRequestInfoRepository);
    }
}
