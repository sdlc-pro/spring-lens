package com.sdlcpro.springlens.storage.security;

import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.SecurityScanStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InMemorySecurityScanRepositoryTest {

    private static final Instant T0 = Instant.parse("2026-11-26T10:00:00Z");

    private InMemorySecurityScanRepository repo;

    @BeforeEach
    void setUp() {
        repo = new InMemorySecurityScanRepository();
    }

    @Test
    void findLatestIsEmptyWhenNothingSaved() {
        assertThat(repo.findLatest()).isEmpty();
    }

    @Test
    void findLatestReturnsMostRecentlyStartedScan() {
        repo.save(SecurityScan.running("s2", "osv", T0.plusSeconds(10)));
        repo.save(SecurityScan.running("s1", "osv", T0));
        assertThat(repo.findLatest()).map(SecurityScan::id).contains("s2");
    }

    @Test
    void savingSameIdOverwritesStatus() {
        SecurityScan running = SecurityScan.running("s1", "osv", T0);
        repo.save(running);
        repo.save(running.completed(T0.plusSeconds(1), Duration.ZERO, Duration.ZERO, List.of(), List.of()));
        assertThat(repo.findById("s1")).map(SecurityScan::status).contains(SecurityScanStatus.COMPLETED);
        assertThat(repo.count()).isEqualTo(1);
    }

    @Test
    void deleteByIdThrowsUnsupported() {
        assertThatThrownBy(() -> repo.deleteById("s1"))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("Scans are not allowed to remove");
    }
}
