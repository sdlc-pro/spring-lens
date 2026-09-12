package com.sdlcpro.springlens.insight.http.request;

import com.sdlcpro.springlens.insight.http.HttpRequestMethodMatcher;
import com.sdlcpro.springlens.insight.http.HttpRequestMethodProvider;
import com.sdlcpro.springlens.insight.http.HttpUriMatcher;
import com.sdlcpro.springlens.insight.http.HttpUriProvider;
import com.sdlcpro.springlens.insight.support.adapter.AsyncListenerAdapter;
import com.sdlcpro.springlens.insight.trace.IdGenerator;
import com.sdlcpro.springlens.insight.util.SafeListenerInvoker;
import com.sdlcpro.springlens.listener.http.request.HttpRequestInfoCollectListener;
import com.sdlcpro.springlens.matcher.CompositeMatcher;
import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.model.http.request.HttpHeader;
import com.sdlcpro.springlens.model.http.request.HttpRequestData;
import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;
import com.sdlcpro.springlens.model.http.request.HttpResponseData;
import com.sdlcpro.springlens.model.http.request.HttpResponseStatus;
import com.sdlcpro.springlens.time.SpringLensClock;
import com.sdlcpro.springlens.util.Preconditions;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Servlet filter that captures an immutable {@link HttpRequestInfo} snapshot for every
 * eligible HTTP request/response transaction and publishes it to any registered
 * {@link HttpRequestInfoCollectListener}.
 *
 * <p>For asynchronously-processed requests (Spring MVC {@code DeferredResult}/{@code Callable}
 * handlers), this filter overrides {@link #shouldNotFilterAsyncDispatch()} so that it is
 * re-entered on the container's {@code ASYNC} re-dispatch once processing actually completes.
 * This is deliberate: writing the buffered response body back on an {@link AsyncListenerAdapter}
 * callback risks running after the response has already been committed by the container, so
 * finalization (including {@link ContentCachingResponseWrapper#copyBodyToResponse()}) always
 * happens from a dispatch cycle, not from the async listener. The listener is only used to learn
 * whether a timeout occurred, since that fact isn't otherwise observable from the redispatch.
 */
public final class HttpRequestInfoCollectorFilter extends OncePerRequestFilter {

    private static final String MASKED_VALUE = "***";
    private static final String CAPTURE_STATE_ATTRIBUTE =
            HttpRequestInfoCollectorFilter.class.getName() + ".CAPTURE_STATE";

    private final HttpRequestCollectorSettings settings;
    private final ObjectProvider<HttpRequestInfoCollectListener> listenerProvider;
    private final CompositeMatcher<HttpRequestEligibilityContext> eligibilityMatcher;

    public HttpRequestInfoCollectorFilter(
            HttpRequestCollectorSettings settings,
            ObjectProvider<HttpRequestInfoCollectListener> listenerProvider) {
        Preconditions.notNull(settings, "HttpRequestCollectorSettings must not be null");
        Preconditions.notNull(listenerProvider, "HttpRequestInfoCollectListener provider must not be null");
        this.settings = settings;
        this.listenerProvider = listenerProvider;
        this.eligibilityMatcher = buildEligibilityMatcher(settings);
    }

    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (request.getDispatcherType() == DispatcherType.ASYNC) {
            this.handleAsyncDispatch(request, response, filterChain);
            return;
        }

        if (!this.isEligible(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        this.handleInitialDispatch(request, response, filterChain);
    }

    private void handleInitialDispatch(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        HttpServletRequest requestToUse = this.settings.includeRequestBody()
                ? new ContentCachingRequestWrapper(request, this.settings.maxBodyLength())
                : request;
        HttpServletResponse responseToUse = this.settings.includeResponseBody()
                ? new ContentCachingResponseWrapper(response)
                : response;

        var state = new CaptureState(
                IdGenerator.getDefault().generateTraceId(),
                SpringLensClock.getClock().now(),
                SpringLensClock.nanoTime());
        request.setAttribute(CAPTURE_STATE_ATTRIBUTE, state);

        try {
            filterChain.doFilter(requestToUse, responseToUse);
        } catch (Throwable ex) {
            state.asyncError = ex;
            this.finalizeAndPublish(requestToUse, responseToUse, state, false);
            throw ex;
        }

        if (requestToUse.isAsyncStarted()) {
            requestToUse.getAsyncContext().addListener(new AsyncTimeoutTracker(state));
            return;
        }

        this.finalizeAndPublish(requestToUse, responseToUse, state, false);
    }

    private void handleAsyncDispatch(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!(request.getAttribute(CAPTURE_STATE_ATTRIBUTE) instanceof CaptureState state)) {
            filterChain.doFilter(request, response);
            return;
        }

        filterChain.doFilter(request, response);
        this.finalizeAndPublish(request, response, state, true);
    }

    private void finalizeAndPublish(
            HttpServletRequest request, HttpServletResponse response, CaptureState state, boolean asyncRequest)
            throws IOException {

        long durationNanos = SpringLensClock.elapsedNanos(state.startNanos);
        HttpRequestData requestData = this.buildRequestData(request);
        HttpResponseData responseData = this.buildResponseData(response);

        if (response instanceof ContentCachingResponseWrapper cachingResponse) {
            cachingResponse.copyBodyToResponse();
        }

        var info = new HttpRequestInfo(
                state.id,
                requestData,
                responseData,
                state.startTime,
                durationNanos,
                asyncRequest,
                asyncRequest && state.asyncTimeoutOccurred,
                state.asyncError);

        SafeListenerInvoker.invoke(this.listenerProvider, info, HttpRequestInfoCollectListener::onHttpRequestInfoCollect);
    }

    private HttpRequestData buildRequestData(HttpServletRequest request) {
        HttpRequestMethod method = HttpRequestMethod.from(request.getMethod());
        Map<String, List<String>> parameters = maskParameters(request.getParameterMap(), this.settings.maskableParams());
        List<HttpHeader> headers = extractRequestHeaders(request, this.settings.maskableHeaders());
        String requestBody = request instanceof ContentCachingRequestWrapper cachingRequest
                ? this.toTruncatedString(cachingRequest.getContentAsByteArray())
                : null;

        return new HttpRequestData(
                method,
                request.getRequestURI(),
                parameters,
                request.getProtocol(),
                request.getContentType(),
                request.getContentLength(),
                request.getRemoteAddr(),
                headers,
                requestBody);
    }

    private HttpResponseData buildResponseData(HttpServletResponse response) {
        HttpResponseStatus status = HttpResponseStatus.from(response.getStatus());
        List<HttpHeader> headers = extractResponseHeaders(response, this.settings.maskableHeaders());

        if (response instanceof ContentCachingResponseWrapper cachingResponse) {
            String responseBody = this.toTruncatedString(cachingResponse.getContentAsByteArray());
            return new HttpResponseData(status, response.getContentType(), cachingResponse.getContentSize(), headers, responseBody);
        }

        return new HttpResponseData(status, response.getContentType(), 0, headers, null);
    }

    private String toTruncatedString(byte[] content) {
        if (content == null || content.length == 0) {
            return null;
        }

        int length = Math.min(content.length, this.settings.maxBodyLength());
        return new String(content, 0, length, StandardCharsets.UTF_8);
    }

    private boolean isEligible(HttpServletRequest request) {
        var context = new HttpRequestEligibilityContext(
                request.getRequestURI(), HttpRequestMethod.from(request.getMethod()));
        return this.eligibilityMatcher.matches(context);
    }

    private static CompositeMatcher<HttpRequestEligibilityContext> buildEligibilityMatcher(HttpRequestCollectorSettings settings) {
        var matcher = new CompositeMatcher<HttpRequestEligibilityContext>();
        matcher.addExcludeMatcher(new HttpUriMatcher<>(settings.excludeUriPatterns()));
        matcher.addExcludeMatcher(new HttpRequestMethodMatcher<>(settings.excludeMethods()));

        if (!settings.includeUriPatterns().isEmpty()) {
            matcher.addIncludeMatcher(new HttpUriMatcher<>(settings.includeUriPatterns()));
        }

        return matcher;
    }

    private static List<HttpHeader> extractRequestHeaders(HttpServletRequest request, Set<String> maskableHeaders) {
        List<HttpHeader> headers = new ArrayList<>();
        Enumeration<String> headerNames = request.getHeaderNames();
        if (headerNames != null) {
            while (headerNames.hasMoreElements()) {
                String name = headerNames.nextElement();
                List<String> values = Collections.list(request.getHeaders(name));
                headers.add(new HttpHeader(name, maskIfNeeded(name, values, maskableHeaders)));
            }
        }

        return headers;
    }

    private static List<HttpHeader> extractResponseHeaders(HttpServletResponse response, Set<String> maskableHeaders) {
        List<HttpHeader> headers = new ArrayList<>();
        for (String name : response.getHeaderNames()) {
            List<String> values = new ArrayList<>(response.getHeaders(name));
            headers.add(new HttpHeader(name, maskIfNeeded(name, values, maskableHeaders)));
        }

        return headers;
    }

    private static Map<String, List<String>> maskParameters(Map<String, String[]> parameterMap, Set<String> maskableParams) {
        Map<String, List<String>> parameters = new LinkedHashMap<>();
        for (var entry : parameterMap.entrySet()) {
            parameters.put(entry.getKey(), maskIfNeeded(entry.getKey(), Arrays.asList(entry.getValue()), maskableParams));
        }

        return parameters;
    }

    private static List<String> maskIfNeeded(String name, List<String> values, Set<String> maskableNames) {
        boolean shouldMask = maskableNames.stream().anyMatch(candidate -> candidate.equalsIgnoreCase(name));
        return shouldMask ? values.stream().map(value -> MASKED_VALUE).toList() : values;
    }

    private record HttpRequestEligibilityContext(String uri, HttpRequestMethod method)
            implements HttpUriProvider, HttpRequestMethodProvider {

        @Override
        public String getHttpUri() {
            return this.uri;
        }

        @Override
        public Set<HttpRequestMethod> getHttpRequestMethods() {
            return Set.of(this.method);
        }
    }

    private static final class CaptureState {
        private final String id;
        private final Instant startTime;
        private final long startNanos;
        private volatile boolean asyncTimeoutOccurred;
        private volatile Throwable asyncError;

        private CaptureState(String id, Instant startTime, long startNanos) {
            this.id = id;
            this.startTime = startTime;
            this.startNanos = startNanos;
        }
    }

    private static final class AsyncTimeoutTracker implements AsyncListenerAdapter {
        private final CaptureState state;

        private AsyncTimeoutTracker(CaptureState state) {
            this.state = state;
        }

        @Override
        public void onTimeout(AsyncEvent event) {
            this.state.asyncTimeoutOccurred = true;
        }

        @Override
        public void onError(AsyncEvent event) {
            this.state.asyncError = event.getThrowable();
        }
    }
}
