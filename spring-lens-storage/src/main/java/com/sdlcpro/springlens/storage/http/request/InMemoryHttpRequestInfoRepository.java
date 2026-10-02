package com.sdlcpro.springlens.storage.http.request;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;
import com.sdlcpro.springlens.query.Filter;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.query.QueryExecutor;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * In-memory implementation of {@link HttpRequestInfoRepository}.
 *
 * <p>Stores {@link HttpRequestInfo} instances in a {@link ConcurrentHashMap}
 * keyed by the transaction's own {@code id}. Paged and filtered queries
 * delegate to {@link QueryExecutor}.</p>
 *
 * @since 1.0.0
 */
@SpringLensInternalComponent
public class InMemoryHttpRequestInfoRepository implements HttpRequestInfoRepository {
    private final QueryExecutor<HttpRequestInfo> queryExecutor;
    private final ConcurrentMap<String, HttpRequestInfo> httpRequestInfoMap;

    public InMemoryHttpRequestInfoRepository() {
        this.queryExecutor = new QueryExecutor<>(HttpRequestInfo.class);
        this.httpRequestInfoMap = new ConcurrentHashMap<>();
    }

    @Override
    public PageResponse<HttpRequestInfo> findAll(PageRequest pageRequest) {
        return this.findAll(Filter.UNFILTERED, pageRequest);
    }

    @Override
    public PageResponse<HttpRequestInfo> findAll(Filter filter, PageRequest pageRequest) {
        return this.queryExecutor.execute(this.httpRequestInfoMap.values(), filter, pageRequest);
    }

    @Override
    public void save(HttpRequestInfo httpRequestInfo) {
        Preconditions.notNull(httpRequestInfo, "HttpRequestInfo must not be null");
        this.httpRequestInfoMap.put(httpRequestInfo.id(), httpRequestInfo);
    }

    @Override
    public List<HttpRequestInfo> findAll() {
        return List.copyOf(this.httpRequestInfoMap.values());
    }

    @Override
    public Optional<HttpRequestInfo> findById(String id) {
        return Optional.ofNullable(this.httpRequestInfoMap.get(id));
    }

    @Override
    public void deleteById(String id) {
        this.httpRequestInfoMap.remove(id);
    }

    @Override
    public long count() {
        return this.httpRequestInfoMap.size();
    }
}
