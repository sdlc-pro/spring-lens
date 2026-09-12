package com.sdlcpro.springlens.insight.http.request;

import com.sdlcpro.springlens.listener.http.request.HttpRequestInfoCollectListener;
import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HttpRequestInfoCollectorFilterTest {

    private static HttpRequestCollectorSettings defaultSettings() {
        return new HttpRequestCollectorSettings(
                Set.of(), Set.of(), false, false, 1024, Set.of(), Set.of(), Set.of());
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<HttpRequestInfoCollectListener> providerFor(AtomicReference<HttpRequestInfo> captured) {
        HttpRequestInfoCollectListener listener = captured::set;
        ObjectProvider<HttpRequestInfoCollectListener> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenReturn(Stream.of(listener));
        return provider;
    }

    @Nested
    @DisplayName("eligibility")
    class Eligibility {

        @Test
        @DisplayName("captures an eligible synchronous request")
        void capturesEligibleSynchronousRequest() throws Exception {
            var captured = new AtomicReference<HttpRequestInfo>();
            var filter = new HttpRequestInfoCollectorFilter(defaultSettings(), providerFor(captured));

            var request = new MockHttpServletRequest("GET", "/api/orders");
            var response = new MockHttpServletResponse();
            FilterChain chain = (req, res) -> ((MockHttpServletResponse) res).setStatus(200);

            filter.doFilter(request, response, chain);

            HttpRequestInfo info = captured.get();
            assertNotNull(info);
            assertNotNull(info.id());
            assertFalse(info.id().isBlank());
            assertEquals(HttpRequestMethod.GET, info.requestData().getMethod());
            assertEquals("/api/orders", info.requestData().getUri());
            assertEquals(200, info.responseData().getStatusCode());
            assertFalse(info.asyncRequest());
            assertFalse(info.asyncTimeout());
            assertNull(info.error());
            assertTrue(info.durationNanos() >= 0);
        }

        @Test
        @DisplayName("skips a request matching an excluded URI pattern")
        void skipsExcludedUriPattern() throws Exception {
            var captured = new AtomicReference<HttpRequestInfo>();
            var settings = new HttpRequestCollectorSettings(
                    Set.of(), Set.of("/spring-lens/**"), false, false, 1024, Set.of(), Set.of(), Set.of());
            var filter = new HttpRequestInfoCollectorFilter(settings, providerFor(captured));

            var request = new MockHttpServletRequest("GET", "/spring-lens/ui/dashboard");
            var response = new MockHttpServletResponse();
            var chainInvoked = new AtomicReference<Boolean>(false);
            FilterChain chain = (req, res) -> chainInvoked.set(true);

            filter.doFilter(request, response, chain);

            assertNull(captured.get());
            assertTrue(chainInvoked.get(), "the request should still reach the rest of the chain");
        }

        @Test
        @DisplayName("skips a request using an excluded HTTP method")
        void skipsExcludedMethod() throws Exception {
            var captured = new AtomicReference<HttpRequestInfo>();
            var settings = new HttpRequestCollectorSettings(
                    Set.of(), Set.of(), false, false, 1024, Set.of(HttpRequestMethod.OPTIONS), Set.of(), Set.of());
            var filter = new HttpRequestInfoCollectorFilter(settings, providerFor(captured));

            var request = new MockHttpServletRequest("OPTIONS", "/api/orders");
            var response = new MockHttpServletResponse();
            FilterChain chain = (req, res) -> ((MockHttpServletResponse) res).setStatus(204);

            filter.doFilter(request, response, chain);

            assertNull(captured.get());
        }
    }

    @Nested
    @DisplayName("masking")
    class Masking {

        @Test
        @DisplayName("masks configured header and parameter values")
        void masksConfiguredHeadersAndParams() throws Exception {
            var captured = new AtomicReference<HttpRequestInfo>();
            var settings = new HttpRequestCollectorSettings(
                    Set.of(), Set.of(), false, false, 1024, Set.of(),
                    Set.of("Authorization"), Set.of("password"));
            var filter = new HttpRequestInfoCollectorFilter(settings, providerFor(captured));

            var request = new MockHttpServletRequest("POST", "/api/login");
            request.addHeader("Authorization", "Bearer secret-token");
            request.addHeader("Accept", "application/json");
            request.setParameter("password", "hunter2");
            request.setParameter("username", "alice");
            var response = new MockHttpServletResponse();
            FilterChain chain = (req, res) -> ((MockHttpServletResponse) res).setStatus(200);

            filter.doFilter(request, response, chain);

            HttpRequestInfo info = captured.get();
            assertNotNull(info);

            var authHeader = info.requestData().getRequestHeaders().stream()
                    .filter(h -> h.name().equalsIgnoreCase("Authorization"))
                    .findFirst()
                    .orElseThrow();
            assertEquals(List.of("***"), authHeader.values());

            var acceptHeader = info.requestData().getRequestHeaders().stream()
                    .filter(h -> h.name().equalsIgnoreCase("Accept"))
                    .findFirst()
                    .orElseThrow();
            assertEquals(List.of("application/json"), acceptHeader.values());

            assertEquals(List.of("***"), info.requestData().getParameters().get("password"));
            assertEquals(List.of("alice"), info.requestData().getParameters().get("username"));
        }
    }

    @Nested
    @DisplayName("body capture")
    class BodyCapture {

        @Test
        @DisplayName("truncates a captured body beyond the configured max length")
        void truncatesBodyBeyondMaxLength() throws Exception {
            var captured = new AtomicReference<HttpRequestInfo>();
            var settings = new HttpRequestCollectorSettings(
                    Set.of(), Set.of(), true, true, 5, Set.of(), Set.of(), Set.of());
            var filter = new HttpRequestInfoCollectorFilter(settings, providerFor(captured));

            var request = new MockHttpServletRequest("POST", "/api/orders");
            request.setContent("0123456789".getBytes(StandardCharsets.UTF_8));
            request.setContentType("text/plain");
            var response = new MockHttpServletResponse();

            FilterChain chain = (req, res) -> {
                req.getInputStream().readAllBytes();
                var httpResponse = (jakarta.servlet.http.HttpServletResponse) res;
                httpResponse.setStatus(200);
                httpResponse.getWriter().write("responsebodylongerthanlimit");
                httpResponse.getWriter().flush();
            };

            filter.doFilter(request, response, chain);

            HttpRequestInfo info = captured.get();
            assertNotNull(info);
            assertEquals("01234", info.requestData().getRequestBody());
            assertTrue(info.requestData().isBodyTruncated());
            assertEquals("respo", info.responseData().getResponseBody());
            assertTrue(info.responseData().isBodyTruncated());
            assertEquals("responsebodylongerthanlimit", response.getContentAsString());
        }
    }

    @Nested
    @DisplayName("error handling")
    class ErrorHandling {

        @Test
        @DisplayName("captures an unhandled exception and rethrows it")
        void capturesUnhandledExceptionAndRethrows() {
            var captured = new AtomicReference<HttpRequestInfo>();
            var filter = new HttpRequestInfoCollectorFilter(defaultSettings(), providerFor(captured));

            var request = new MockHttpServletRequest("GET", "/api/orders");
            var response = new MockHttpServletResponse();
            var failure = new IllegalStateException("boom");
            FilterChain chain = (req, res) -> {
                throw failure;
            };

            assertThrows(IllegalStateException.class, () -> filter.doFilter(request, response, chain));

            HttpRequestInfo info = captured.get();
            assertNotNull(info);
            assertSame(failure, info.error());
        }
    }

    @Nested
    @DisplayName("async requests")
    class AsyncRequests {

        @Test
        @DisplayName("finalizes on the async re-dispatch and records a timeout observed by the async listener")
        void capturesAsyncCompletionWithTimeout() throws Exception {
            var captured = new AtomicReference<HttpRequestInfo>();
            var filter = new HttpRequestInfoCollectorFilter(defaultSettings(), providerFor(captured));

            var request = new MockHttpServletRequest("GET", "/api/orders");
            request.setAsyncSupported(true);
            var response = new MockHttpServletResponse();

            FilterChain initialChain = (req, res) -> req.startAsync();
            filter.doFilter(request, response, initialChain);

            assertNull(captured.get(), "should not publish until the async dispatch completes");
            assertTrue(request.isAsyncStarted());

            List<AsyncListener> listeners = ((org.springframework.mock.web.MockAsyncContext) request.getAsyncContext()).getListeners();
            assertEquals(1, listeners.size());
            listeners.get(0).onTimeout(new AsyncEvent(request.getAsyncContext()));

            request.setDispatcherType(DispatcherType.ASYNC);
            FilterChain asyncChain = (req, res) -> ((MockHttpServletResponse) res).setStatus(200);
            filter.doFilter(request, response, asyncChain);

            HttpRequestInfo info = captured.get();
            assertNotNull(info);
            assertTrue(info.asyncRequest());
            assertTrue(info.asyncTimeout());
            assertEquals(200, info.responseData().getStatusCode());
        }
    }
}
