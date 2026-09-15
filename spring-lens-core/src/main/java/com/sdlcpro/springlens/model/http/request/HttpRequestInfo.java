package com.sdlcpro.springlens.model.http.request;

import com.sdlcpro.springlens.util.Preconditions;

import java.time.Instant;

/**
 * Immutable top-level record aggregating the captured request and response
 * snapshots of a single HTTP transaction, along with runtime execution
 * metrics such as timing, asynchronous processing state, and any
 * unhandled exception that occurred during processing.
 */
public record HttpRequestInfo(
        String id,
        HttpRequestData requestData,
        HttpResponseData responseData,
        Instant startTime,
        long durationNanos,
        boolean asyncRequest,
        boolean asyncTimeout,
        Throwable error) {

    public HttpRequestInfo {
        Preconditions.hasText(id, "The value of id must not be blank");
        Preconditions.notNull(requestData, "HttpRequestData must not be null");
        Preconditions.notNull(responseData, "HttpResponseData must not be null");
        Preconditions.notNull(startTime, "The value of startTime must not be null");
        Preconditions.isTrue(durationNanos >= 0, "The value of durationNanos must be non-negative");

        Preconditions.isTrue(
                asyncRequest || !asyncTimeout,
                "The value of asyncTimeout cannot be true when asyncRequest is false");
    }
}
