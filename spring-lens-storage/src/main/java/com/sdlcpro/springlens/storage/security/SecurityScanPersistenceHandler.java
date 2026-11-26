package com.sdlcpro.springlens.storage.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.listener.security.SecurityScanListener;
import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.SecurityScanResult;
import com.sdlcpro.springlens.model.security.SecurityScanStatus;
import com.sdlcpro.springlens.repository.security.DependencyInfoRepository;
import com.sdlcpro.springlens.repository.security.SecurityScanRepository;
import com.sdlcpro.springlens.repository.security.VulnerabilityFindingRepository;

/**
 * Persistence handler that bridges security scan events with storage.
 * <p>
 * Findings are replaced only when the scan completed successfully, so a transient
 * data source failure does not wipe the last good findings.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
public class SecurityScanPersistenceHandler implements SecurityScanListener {

    private final SecurityScanRepository scanRepository;
    private final DependencyInfoRepository dependencyRepository;
    private final VulnerabilityFindingRepository findingRepository;

    /**
     * Creates a new {@link SecurityScanPersistenceHandler}.
     *
     * @param scanRepository       repository used to save scans
     * @param dependencyRepository repository used to replace the dependency inventory
     * @param findingRepository    repository used to replace findings
     */
    public SecurityScanPersistenceHandler(SecurityScanRepository scanRepository,
                                          DependencyInfoRepository dependencyRepository,
                                          VulnerabilityFindingRepository findingRepository) {
        this.scanRepository = scanRepository;
        this.dependencyRepository = dependencyRepository;
        this.findingRepository = findingRepository;
    }

    /**
     * Saves the running scan, ignoring {@code null}.
     *
     * @param scan the started scan
     */
    @Override
    public void onSecurityScanStarted(SecurityScan scan) {
        if (scan != null) {
            this.scanRepository.save(scan);
        }
    }

    /**
     * Saves the scan and replaces the dependencies; replaces findings only when the
     * scan completed. A {@code null} result is ignored.
     *
     * @param result the scan result
     */
    @Override
    public void onSecurityScanCompleted(SecurityScanResult result) {
        if (result == null) {
            return;
        }
        this.scanRepository.save(result.scan());
        this.dependencyRepository.replaceAll(result.dependencies());
        if (result.scan().status() == SecurityScanStatus.COMPLETED) {
            this.findingRepository.replaceAll(result.findings());
        }
    }
}
