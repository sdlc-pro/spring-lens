package com.sdlcpro.springlens.storage.security;

import com.sdlcpro.springlens.model.security.DependencyEcosystem;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.SecurityScanResult;
import com.sdlcpro.springlens.model.security.VulnerabilityFinding;
import com.sdlcpro.springlens.model.security.VulnerabilitySeverity;
import com.sdlcpro.springlens.repository.security.DependencyInfoRepository;
import com.sdlcpro.springlens.repository.security.SecurityScanRepository;
import com.sdlcpro.springlens.repository.security.VulnerabilityFindingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class SecurityScanPersistenceHandlerTest {

    @Mock
    private SecurityScanRepository scanRepository;
    @Mock
    private DependencyInfoRepository dependencyRepository;
    @Mock
    private VulnerabilityFindingRepository findingRepository;

    @InjectMocks
    private SecurityScanPersistenceHandler handler;

    private final Instant now = Instant.parse("2026-11-26T10:00:00Z");
    private final SecurityScan running = SecurityScan.running("scan-1", "OSV", now);
    private final List<DependencyInfo> deps = List.of(
            new DependencyInfo("org.example", "lib", "1.0", DependencyEcosystem.MAVEN, null, null));
    private final List<VulnerabilityFinding> findings = List.of(
            new VulnerabilityFinding("GHSA-1", null, deps.get(0).key(), "s", VulnerabilitySeverity.HIGH,
                    null, null, null, null, null, null, null));

    @Test
    void onStartedSavesRunningScan() {
        handler.onSecurityScanStarted(running);

        verify(scanRepository).save(running);
        verifyNoInteractions(dependencyRepository, findingRepository);
    }

    @Test
    void onStartedIgnoresNullScan() {
        handler.onSecurityScanStarted(null);

        verifyNoInteractions(scanRepository, dependencyRepository, findingRepository);
    }

    @Test
    void onCompletedSavesScanAndReplacesDependenciesAndFindings() {
        SecurityScan completed = running.completed(now, Duration.ZERO, Duration.ZERO, deps, findings);

        handler.onSecurityScanCompleted(new SecurityScanResult(completed, deps, findings));

        verify(scanRepository).save(completed);
        verify(dependencyRepository).replaceAll(deps);
        verify(findingRepository).replaceAll(findings);
    }

    @Test
    void onFailedSavesScanAndDependenciesButKeepsPreviousFindings() {
        SecurityScan failed = running.failed(now, Duration.ZERO, deps, "boom");

        handler.onSecurityScanCompleted(new SecurityScanResult(failed, deps, List.of()));

        verify(scanRepository).save(failed);
        verify(dependencyRepository).replaceAll(deps);
        verify(findingRepository, never()).replaceAll(any());
    }

    @Test
    void ignoresNullResult() {
        handler.onSecurityScanCompleted(null);

        verifyNoInteractions(scanRepository, dependencyRepository, findingRepository);
    }
}
