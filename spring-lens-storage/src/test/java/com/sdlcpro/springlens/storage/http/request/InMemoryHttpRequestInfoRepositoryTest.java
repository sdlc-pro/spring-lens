package com.sdlcpro.springlens.storage.http.request;

import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.model.http.request.HttpRequestData;
import com.sdlcpro.springlens.model.http.request.HttpRequestInfo;
import com.sdlcpro.springlens.model.http.request.HttpResponseData;
import com.sdlcpro.springlens.model.http.request.HttpResponseStatus;
import com.sdlcpro.springlens.query.Filters;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.query.Sort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryHttpRequestInfoRepositoryTest {

    private InMemoryHttpRequestInfoRepository repository;

    @BeforeEach
    void setUp() {
        repository = new InMemoryHttpRequestInfoRepository();
    }

    private static HttpRequestInfo httpRequestInfo(String id, String uri) {
        HttpRequestData requestData = new HttpRequestData(
                HttpRequestMethod.GET, uri, Map.of(), "HTTP/1.1",
                "application/json", 0, "127.0.0.1", List.of(), null);
        HttpResponseData responseData = new HttpResponseData(
                HttpResponseStatus.OK, "application/json", 0, List.of(), null);
        return new HttpRequestInfo(id, requestData, responseData, Instant.now(), 1000L, false, false, null);
    }

    @Test
    void saveThenFindByIdAndCount() {
        HttpRequestInfo info = httpRequestInfo("id-1", "/api/orders");
        repository.save(info);

        assertThat(repository.count()).isEqualTo(1);
        assertThat(repository.findById("id-1")).contains(info);
        assertThat(repository.findAll()).containsExactly(info);
    }

    @Test
    void saveOverwritesSameId() {
        repository.save(httpRequestInfo("id-1", "/api/orders"));
        HttpRequestInfo updated = httpRequestInfo("id-1", "/api/orders/updated");
        repository.save(updated);

        assertThat(repository.count()).isEqualTo(1);
        assertThat(repository.findById("id-1")).contains(updated);
    }

    @Test
    void deleteByIdRemovesEntry() {
        repository.save(httpRequestInfo("id-1", "/api/orders"));

        repository.deleteById("id-1");

        assertThat(repository.count()).isZero();
        assertThat(repository.findById("id-1")).isEmpty();
    }

    @Test
    void deleteByIdIsNoOpForUnknownId() {
        repository.save(httpRequestInfo("id-1", "/api/orders"));

        repository.deleteById("does-not-exist");

        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void findAllWithPageRequestPaginates() {
        repository.save(httpRequestInfo("id-1", "/api/a"));
        repository.save(httpRequestInfo("id-2", "/api/b"));
        repository.save(httpRequestInfo("id-3", "/api/c"));

        PageRequest page0 = new PageRequest(0, 2, Sort.unsorted());
        PageResponse<HttpRequestInfo> response = repository.findAll(page0);

        assertThat(response.getTotalElements()).isEqualTo(3);
        assertThat(response.getContent()).hasSize(2);
    }

    @Test
    void findAllWithFilterAndPageRequest() {
        repository.save(httpRequestInfo("id-1", "/api/keep-me"));
        repository.save(httpRequestInfo("id-2", "/api/skip-me"));

        PageRequest page = new PageRequest(0, 10, Sort.unsorted());
        PageResponse<HttpRequestInfo> response =
                repository.findAll(Filters.eq("id", "id-1"), page);

        assertThat(response.getTotalElements()).isEqualTo(1);
        assertThat(response.getContent()).extracting(HttpRequestInfo::id).containsExactly("id-1");
    }
}
