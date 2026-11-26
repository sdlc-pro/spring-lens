package com.sdlcpro.springlens.repository.security;

import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.repository.Repository;

import java.util.Optional;

/**
 * Repository contract for managing {@link SecurityScan} domain models, keyed by scan id.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
public interface SecurityScanRepository extends Repository<SecurityScan, String> {

    /**
     * Returns the most recently saved scan, if any.
     *
     * @return the latest scan or empty when none was saved
     */
    Optional<SecurityScan> findLatest();
}
