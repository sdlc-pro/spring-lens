package com.sdlcpro.springlens.inspector.security;

import com.sdlcpro.springlens.model.security.DependencyInfo;

import java.util.List;

/**
 * Collects the inventory of dependencies present on the application's classpath.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
public interface DependencyInventoryCollector {

    /**
     * Collects the dependency inventory.
     *
     * @return the discovered dependencies
     */
    List<DependencyInfo> collect();
}
