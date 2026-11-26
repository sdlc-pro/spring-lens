package com.sdlcpro.springlens.model.security;

import com.sdlcpro.springlens.util.DefensiveCopies;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.List;

/**
 * Immutable outcome of a security scan: metadata, inventory and findings.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 *
 * @param scan         scan metadata
 * @param dependencies dependency inventory
 * @param findings     vulnerability findings
 */
public record SecurityScanResult(
        SecurityScan scan,
        List<DependencyInfo> dependencies,
        List<VulnerabilityFinding> findings
) {

    /**
     * Creates a scan result.
     *
     * @param scan         scan metadata
     * @param dependencies dependencies, {@code null} means none
     * @param findings     findings, {@code null} means none
     */
    public SecurityScanResult {
        Preconditions.notNull(scan, "SecurityScanResult scan must not be null");
        dependencies = DefensiveCopies.immutableListOrEmpty(dependencies);
        findings = DefensiveCopies.immutableListOrEmpty(findings);
    }
}
