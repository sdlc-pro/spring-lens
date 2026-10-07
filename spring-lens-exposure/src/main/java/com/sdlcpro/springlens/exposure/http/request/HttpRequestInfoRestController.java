package com.sdlcpro.springlens.exposure.http.request;

import com.sdlcpro.springlens.annotation.SpringLensEndpoint;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.ApiResponseHandler;
import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.model.http.request.HttpResponseStatus;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.Sort;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static com.sdlcpro.springlens.query.Filters.*;

/**
 * REST controller that exposes the HTTP request/response transactions captured by Spring Lens.
 */
@RestController
@SpringLensEndpoint
@SpringLensInternalComponent
@RequestMapping("/spring-lens/api/http/requests")
public class HttpRequestInfoRestController {
    private static final int MAX_PAGE_SIZE = 1000;

    private final HttpRequestInfoRepository httpRequestInfoRepository;

    /**
     * Creates a new controller backed by the given repository.
     *
     * @param httpRequestInfoRepository the repository holding the captured HTTP transactions;
     *                                  must not be {@code null}
     */
    public HttpRequestInfoRestController(HttpRequestInfoRepository httpRequestInfoRepository) {
        this.httpRequestInfoRepository = httpRequestInfoRepository;
    }

    /**
     * Returns a page of captured HTTP request/response transactions.
     *
     * @param method     the HTTP method to filter by (e.g. GET, POST)
     * @param uri        substring to match against the request URI
     * @param statusCode the HTTP response status code to filter by
     * @param clientIpAddress the client IP address to filter by
     * @param search     free text search value applied across the request URI and client IP
     * @param pageNumber zero-based page index (defaults to {@code 0})
     * @param pageSize   the number of records per page (defaults to {@code 10})
     * @param sortBy     optional property name to sort by
     * @param sortDir    optional sort direction ({@code ASC} or {@code DESC}); defaults to
     *                   ascending when a {@code sortBy} property is supplied
     * @return a {@link ResponseEntity} wrapping the requested
     * {@link com.sdlcpro.springlens.query.PageResponse page} of HTTP transactions
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getHttpRequestInfo(
            @RequestParam(value = "method", required = false) String method,
            @RequestParam(value = "uri", required = false) String uri,
            @RequestParam(value = "statusCode", required = false) Integer statusCode,
            @RequestParam(value = "clientIpAddress", required = false) String clientIpAddress,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "pageNumber", defaultValue = "0") int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "10") int pageSize,
            @RequestParam(value = "sortBy", required = false) String sortBy,
            @RequestParam(value = "sortDir", required = false, defaultValue = "ASC") String sortDir) {
        var sort = sortBy == null ? Sort.unsorted() : Sort.by(sortBy, sortDir);
        var pageRequest = new PageRequest(Math.max(pageNumber, 0), Math.min(pageSize, MAX_PAGE_SIZE), sort);

        return ApiResponseHandler.handle(() -> {
            var filter = and(
                    eqIfPresent("requestData.method", method, HttpRequestMethod::from),
                    containsIgnoreCaseIfPresent("requestData.uri", uri),
                    eqIfPresent("responseData.status", statusCode, HttpResponseStatus::from),
                    eqIfPresent("requestData.clientIpAddress", clientIpAddress),
                    orIfPresent(
                            search,
                            containsIgnoreCaseIfPresent("requestData.uri", search),
                            containsIgnoreCaseIfPresent("requestData.clientIpAddress", search)));

            return this.httpRequestInfoRepository.findAll(filter, pageRequest);
        });
    }

    /**
     * Returns a single captured HTTP transaction by its id.
     *
     * @param id the transaction id
     * @return a {@link ResponseEntity} wrapping the matching
     * {@link com.sdlcpro.springlens.model.http.request.HttpRequestInfo}
     */
    @GetMapping(value = "/find", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getHttpRequestInfoById(@RequestParam("id") String id) {
        return ApiResponseHandler.handle(
                () -> this.httpRequestInfoRepository.findById(id),
                "No HTTP request transaction found with id '%s'".formatted(id)
        );
    }
}
