package com.sdlcpro.springlens.repository.security;

import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import com.sdlcpro.springlens.repository.PageableRepository;

import java.util.Collection;

/**
 * Repository contract for managing {@link DependencyInfo} domain models.
 * Provides pageable access and key-based lookup operations using {@link DependencyKey}.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
public interface DependencyInfoRepository extends PageableRepository<DependencyInfo, DependencyKey> {

    /**
     * Atomically replaces the whole dependency inventory with the given dependencies.
     *
     * @param dependencies the new inventory
     */
    void replaceAll(Collection<DependencyInfo> dependencies);
}
