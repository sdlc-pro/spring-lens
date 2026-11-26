package com.sdlcpro.springlens.model.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.sdlcpro.springlens.model.security.DependencyEcosystem.MAVEN;
import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.EVALUATED;
import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.NOT_EVALUATED;
import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.UNRESOLVED;
import static com.sdlcpro.springlens.model.security.SecurityScanStatus.COMPLETED;
import static com.sdlcpro.springlens.model.security.SecurityScanStatus.FAILED;
import static com.sdlcpro.springlens.model.security.SecurityScanStatus.RUNNING;
import static com.sdlcpro.springlens.model.security.VulnerabilitySeverity.CRITICAL;
import static com.sdlcpro.springlens.model.security.VulnerabilitySeverity.HIGH;
import static com.sdlcpro.springlens.model.security.VulnerabilitySeverity.UNKNOWN;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
class SecurityScanTest {

    static final Instant T0 = Instant.parse("2026-11-26T10:00:00Z");

    static DependencyInfo resolvedDep(String group, String artifact, String version, DependencyEvaluationStatus status) {
        return new DependencyInfo(group, artifact, version, MAVEN, "file:/" + artifact + ".jar", status);
    }

    static DependencyInfo unresolvedDep(String artifact) {
        return new DependencyInfo(null, artifact, null, MAVEN, "file:/" + artifact + ".jar", UNRESOLVED);
    }

    static VulnerabilityFinding finding(String id, VulnerabilitySeverity severity) {
        return finding(id, severity, new DependencyKey("org.yaml", "snakeyaml", "1.33"));
    }

    static VulnerabilityFinding finding(String id, VulnerabilitySeverity severity, DependencyKey dependency) {
        return new VulnerabilityFinding(id, null, dependency, "summary", severity, null, null, null, null, null, null, null);
    }

    static List<DependencyInfo> deps() {
        return List.of(resolvedDep("org.yaml", "snakeyaml", "1.33", EVALUATED),
                resolvedDep("com.x", "y", "1", EVALUATED), unresolvedDep("tools"));
    }

    @Test
    void runningHasNoCountsAndNoCompletedAt() {
        var scan = SecurityScan.running("scan-1", "osv.dev", T0);

        assertThat(scan.status()).isEqualTo(RUNNING);
        assertThat(scan.completedAt()).isNull();
        assertThat(scan.startedAt()).isEqualTo(T0);
        assertThat(scan.findingCountBySeverity()).containsEntry(CRITICAL, 0).containsEntry(UNKNOWN, 0).hasSize(5);
    }

    @Test
    void completedCountsDependenciesAndFindingsBySeverity() {
        var findings = List.of(finding("GHSA-1", HIGH), finding("GHSA-2", HIGH), finding("GHSA-3", UNKNOWN));

        var scan = SecurityScan.running("scan-1", "osv.dev", T0)
                .completed(T0.plusSeconds(3), Duration.ofMillis(120), Duration.ofMillis(900), deps(), findings);

        assertThat(scan.id()).isEqualTo("scan-1");
        assertThat(scan.dataSource()).isEqualTo("osv.dev");
        assertThat(scan.startedAt()).isEqualTo(T0);
        assertThat(scan.completedAt()).isEqualTo(T0.plusSeconds(3));
        assertThat(scan.status()).isEqualTo(COMPLETED);
        assertThat(scan.dependencyCount()).isEqualTo(3);
        assertThat(scan.evaluatedDependencyCount()).isEqualTo(2);
        assertThat(scan.unresolvedDependencyCount()).isEqualTo(1);
        assertThat(scan.findingCount()).isEqualTo(3);
        assertThat(scan.findingCountBySeverity()).containsEntry(HIGH, 2).containsEntry(UNKNOWN, 1).containsEntry(CRITICAL, 0);
        assertThat(scan.errorMessage()).isNull();
    }

    @Test
    void failedKeepsDependencyCountAndMessage() {
        var deps = deps();

        var scan = SecurityScan.running("scan-1", "osv.dev", T0)
                .failed(T0.plusSeconds(1), Duration.ofMillis(50), deps, "HTTP 503 from OSV");

        assertThat(scan.status()).isEqualTo(FAILED);
        assertThat(scan.dependencyCount()).isEqualTo(deps.size());
        assertThat(scan.evaluatedDependencyCount()).isZero();
        assertThat(scan.unresolvedDependencyCount())
                .isEqualTo((int) deps.stream().filter(d -> d.evaluationStatus() == UNRESOLVED).count());
        assertThat(scan.findingCount()).isZero();
        assertThat(scan.evaluationDuration()).isNull();
        assertThat(scan.findingCountBySeverity()).hasSize(5).containsEntry(HIGH, 0);
        assertThat(scan.errorMessage()).isEqualTo("HTTP 503 from OSV");
    }

    @Test
    void rejectsBlankIdAndNullStatusAndNullStartedAt() {
        assertThatThrownBy(() -> SecurityScan.running(" ", "osv.dev", T0))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("SecurityScan id must not be blank");
        assertThatThrownBy(() -> new SecurityScan("s", null, "osv.dev", T0, null, null, null, 0, 0, 0, 0, null, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("SecurityScan status must not be null");
        assertThatThrownBy(() -> SecurityScan.running("s", "osv.dev", null))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("SecurityScan startedAt must not be null");
    }

    @Test
    void nullSeverityMapBecomesAllZero() {
        var scan = new SecurityScan("s", RUNNING, "osv.dev", T0, null, null, null, 0, 0, 0, 0, null, null);

        assertThat(scan.findingCountBySeverity()).hasSize(5);
        assertThat(scan.findingCountBySeverity().values()).containsOnly(0);
    }

    @Test
    void partialSeverityMapIsFilledWithZeros() {
        var scan = new SecurityScan("s", RUNNING, "osv.dev", T0, null, null, null, 0, 0, 0, 0, Map.of(HIGH, 4), null);

        assertThat(scan.findingCountBySeverity()).hasSize(5).containsEntry(HIGH, 4).containsEntry(CRITICAL, 0);
        assertThat(scan.findingCountBySeverity().keySet()).containsExactly(VulnerabilitySeverity.values());
    }

    @Test
    void findingCountBySeverityIsImmutable() {
        var scan = SecurityScan.running("scan-1", "osv.dev", T0);

        assertThatThrownBy(() -> scan.findingCountBySeverity().put(HIGH, 9))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void notEvaluatedDependenciesAreNotCounted() {
        var deps = List.of(resolvedDep("a", "b", "1", NOT_EVALUATED));

        var scan = SecurityScan.running("s", "osv.dev", T0)
                .completed(T0, Duration.ZERO, Duration.ZERO, deps, List.of());

        assertThat(scan.evaluatedDependencyCount()).isZero();
        assertThat(scan.unresolvedDependencyCount()).isZero();
    }
}
