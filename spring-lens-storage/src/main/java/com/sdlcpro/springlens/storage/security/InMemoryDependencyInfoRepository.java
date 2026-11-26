package com.sdlcpro.springlens.storage.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import com.sdlcpro.springlens.query.Filter;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.query.QueryExecutor;
import com.sdlcpro.springlens.repository.security.DependencyInfoRepository;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * In-memory {@link DependencyInfoRepository}. {@link #replaceAll(Collection)} swaps an immutable
 * snapshot through a volatile reference, so readers never observe a half-replaced set.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
public class InMemoryDependencyInfoRepository implements DependencyInfoRepository {
    private final QueryExecutor<DependencyInfo> queryExecutor;
    private final Object writeLock = new Object();
    private volatile Map<DependencyKey, DependencyInfo> items;

    public InMemoryDependencyInfoRepository() {
        this.queryExecutor = new QueryExecutor<>(DependencyInfo.class);
        this.items = Collections.emptyMap();
    }

    @Override
    public PageResponse<DependencyInfo> findAll(PageRequest pageRequest) {
        return this.findAll(Filter.UNFILTERED, pageRequest);
    }

    @Override
    public PageResponse<DependencyInfo> findAll(Filter filter, PageRequest pageRequest) {
        return this.queryExecutor.execute(this.items.values(), filter, pageRequest);
    }

    @Override
    public void save(DependencyInfo item) {
        Preconditions.notNull(item, "DependencyInfo must not be null");
        synchronized (this.writeLock) {
            Map<DependencyKey, DependencyInfo> copy = new LinkedHashMap<>(this.items);
            copy.put(item.key(), item);
            this.items = Collections.unmodifiableMap(copy);
        }
    }

    @Override
    public void replaceAll(Collection<DependencyInfo> newItems) {
        Preconditions.notNull(newItems, "DependencyInfo collection must not be null");
        Map<DependencyKey, DependencyInfo> copy = new LinkedHashMap<>();
        for (DependencyInfo item : newItems) {
            copy.put(item.key(), item);
        }
        synchronized (this.writeLock) {
            this.items = Collections.unmodifiableMap(copy);
        }
    }

    @Override
    public List<DependencyInfo> findAll() {
        return List.copyOf(this.items.values());
    }

    @Override
    public Optional<DependencyInfo> findById(DependencyKey key) {
        return Optional.ofNullable(this.items.get(key));
    }

    @Override
    public void deleteById(DependencyKey key) {
        throw new UnsupportedOperationException("Dependencies are not allowed to remove");
    }

    @Override
    public long count() {
        return this.items.size();
    }
}
