package com.sdlcpro.springlens.repository.http;

import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;
import com.sdlcpro.springlens.repository.PageableRepository;

/**
 * Repository contract for managing captured {@link HttpRequestInfo} transactions.
 * Provides pageable, filterable access keyed by the transaction's own {@code id}.
 */
public interface HttpRequestInfoRepository extends PageableRepository<HttpRequestInfo, String> {

}
