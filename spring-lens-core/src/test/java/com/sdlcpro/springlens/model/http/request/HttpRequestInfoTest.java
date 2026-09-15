package com.sdlcpro.springlens.model.http.request;

import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class HttpRequestInfoTest {

    private static final String SAMPLE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

    private HttpRequestData sampleRequestData() {
        return new HttpRequestData(
                HttpRequestMethod.GET,
                "/api/orders",
                Map.of(),
                "HTTP/1.1",
                "application/json",
                0,
                "127.0.0.1",
                List.of(),
                null);
    }

    private HttpResponseData sampleResponseData() {
        return new HttpResponseData(
                HttpResponseStatus.OK,
                "application/json",
                0,
                List.of(),
                null);
    }

    @Test
    @DisplayName("should construct successfully with valid arguments")
    void constructsSuccessfullyWithValidArguments() {
        HttpRequestInfo info = new HttpRequestInfo(
                SAMPLE_ID, sampleRequestData(), sampleResponseData(), Instant.now(), 1000L, false, false, null);

        assertEquals(SAMPLE_ID, info.id());
        assertEquals(1000L, info.durationNanos());
        assertFalse(info.asyncRequest());
        assertFalse(info.asyncTimeout());
        assertNull(info.error());
    }

    @Test
    @DisplayName("should reject null id")
    void rejectsNullId() {
        assertThrows(IllegalArgumentException.class,
                () -> new HttpRequestInfo(null, sampleRequestData(), sampleResponseData(), Instant.now(), 0, false, false, null));
    }

    @Test
    @DisplayName("should reject blank id")
    void rejectsBlankId() {
        assertThrows(IllegalArgumentException.class,
                () -> new HttpRequestInfo("   ", sampleRequestData(), sampleResponseData(), Instant.now(), 0, false, false, null));
    }

    @Test
    @DisplayName("should reject null requestData")
    void rejectsNullRequestData() {
        assertThrows(IllegalArgumentException.class,
                () -> new HttpRequestInfo(SAMPLE_ID, null, sampleResponseData(), Instant.now(), 0, false, false, null));
    }

    @Test
    @DisplayName("should reject null responseData")
    void rejectsNullResponseData() {
        assertThrows(IllegalArgumentException.class,
                () -> new HttpRequestInfo(SAMPLE_ID, sampleRequestData(), null, Instant.now(), 0, false, false, null));
    }

    @Test
    @DisplayName("should reject null startTime")
    void rejectsNullStartTime() {
        assertThrows(IllegalArgumentException.class,
                () -> new HttpRequestInfo(SAMPLE_ID, sampleRequestData(), sampleResponseData(), null, 0, false, false, null));
    }

    @Test
    @DisplayName("should reject negative durationNanos")
    void rejectsNegativeDuration() {
        assertThrows(IllegalArgumentException.class, () -> new HttpRequestInfo(SAMPLE_ID, sampleRequestData(),
                sampleResponseData(), Instant.now(), -1, false, false, null));
    }

    @Test
    @DisplayName("should accept zero durationNanos")
    void acceptsZeroDuration() {
        assertDoesNotThrow(() -> new HttpRequestInfo(SAMPLE_ID, sampleRequestData(), sampleResponseData(), Instant.now(), 0, false,
                false, null));
    }

    @Test
    @DisplayName("should reject asyncTimeout true when asyncRequest is false")
    void rejectsAsyncTimeoutWithoutAsyncRequest() {
        assertThrows(IllegalArgumentException.class, () -> new HttpRequestInfo(SAMPLE_ID, sampleRequestData(),
                sampleResponseData(), Instant.now(), 0, false, true, null));
    }

    @Test
    @DisplayName("should accept asyncTimeout true when asyncRequest is true")
    void acceptsAsyncTimeoutWithAsyncRequest() {
        assertDoesNotThrow(() -> new HttpRequestInfo(SAMPLE_ID, sampleRequestData(), sampleResponseData(), Instant.now(), 0, true,
                true, null));
    }

    @Test
    @DisplayName("should accept asyncRequest true with asyncTimeout false")
    void acceptsAsyncRequestWithoutTimeout() {
        assertDoesNotThrow(() -> new HttpRequestInfo(SAMPLE_ID, sampleRequestData(), sampleResponseData(), Instant.now(), 0, true,
                false, null));
    }

    @Test
    @DisplayName("should carry the captured error when processing failed")
    void carriesProcessingError() {
        RuntimeException error = new RuntimeException("boom");
        HttpRequestInfo info = new HttpRequestInfo(
                SAMPLE_ID, sampleRequestData(), sampleResponseData(), Instant.now(), 0, false, false, error);

        assertSame(error, info.error());
    }
}
