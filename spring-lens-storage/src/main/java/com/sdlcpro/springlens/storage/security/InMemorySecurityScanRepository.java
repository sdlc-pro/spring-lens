package com.sdlcpro.springlens.storage.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.repository.security.SecurityScanRepository;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * In-memory {@link SecurityScanRepository}.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
public class InMemorySecurityScanRepository implements SecurityScanRepository {
    private final ConcurrentMap<String, SecurityScan> scans = new ConcurrentHashMap<>();

    @Override
    public void save(SecurityScan scan) {
        Preconditions.notNull(scan, "SecurityScan must not be null");
        this.scans.put(scan.id(), scan);
    }

    @Override
    public List<SecurityScan> findAll() {
        return List.copyOf(this.scans.values());
    }

    @Override
    public Optional<SecurityScan> findById(String id) {
        return Optional.ofNullable(this.scans.get(id));
    }

    @Override
    public Optional<SecurityScan> findLatest() {
        return this.scans.values().stream().max(Comparator.comparing(SecurityScan::startedAt));
    }

    @Override
    public void deleteById(String id) {
        throw new UnsupportedOperationException("Scans are not allowed to remove");
    }

    @Override
    public long count() {
        return this.scans.size();
    }
}
