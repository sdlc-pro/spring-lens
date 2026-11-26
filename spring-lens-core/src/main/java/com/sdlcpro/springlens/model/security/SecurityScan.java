package com.sdlcpro.springlens.model.security;

import com.sdlcpro.springlens.util.Preconditions;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable metadata of a security scan run.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 *
 * @param id                       scan identifier
 * @param status                   scan status
 * @param dataSource               vulnerability data source name
 * @param startedAt                start time
 * @param completedAt              completion time, {@code null} while running
 * @param inventoryDuration        time spent collecting the dependency inventory, may be {@code null}
 * @param evaluationDuration       time spent evaluating dependencies, may be {@code null}
 * @param dependencyCount          number of inventoried dependencies
 * @param evaluatedDependencyCount number of evaluated dependencies
 * @param unresolvedDependencyCount number of dependencies whose coordinates could not be resolved
 * @param findingCount             number of findings
 * @param findingCountBySeverity   findings per severity, always containing every severity
 * @param errorMessage             failure description, may be {@code null}
 */
public record SecurityScan(
        String id,
        SecurityScanStatus status,
        String dataSource,
        Instant startedAt,
        Instant completedAt,
        Duration inventoryDuration,
        Duration evaluationDuration,
        int dependencyCount,
        int evaluatedDependencyCount,
        int unresolvedDependencyCount,
        int findingCount,
        Map<VulnerabilitySeverity, Integer> findingCountBySeverity,
        String errorMessage
) {

    /**
     * Creates a scan description.
     *
     * @param id                        scan identifier
     * @param status                    scan status
     * @param dataSource                data source name, may be {@code null}
     * @param startedAt                 start time
     * @param completedAt               completion time, may be {@code null}
     * @param inventoryDuration         inventory duration, may be {@code null}
     * @param evaluationDuration        evaluation duration, may be {@code null}
     * @param dependencyCount           number of dependencies
     * @param evaluatedDependencyCount  number of evaluated dependencies
     * @param unresolvedDependencyCount number of unresolved dependencies
     * @param findingCount              number of findings
     * @param findingCountBySeverity    findings per severity, {@code null} means all zero
     * @param errorMessage              failure description, may be {@code null}
     */
    public SecurityScan {
        Preconditions.hasText(id, "SecurityScan id must not be blank");
        Preconditions.notNull(status, "SecurityScan status must not be null");
        Preconditions.notNull(startedAt, "SecurityScan startedAt must not be null");
        findingCountBySeverity = normalise(findingCountBySeverity);
    }

    /**
     * Creates a running scan.
     *
     * @param id         scan identifier
     * @param dataSource data source name
     * @param startedAt  start time
     * @return running scan with zero counts
     */
    public static SecurityScan running(String id, String dataSource, Instant startedAt) {
        return new SecurityScan(id, SecurityScanStatus.RUNNING, dataSource, startedAt,
                null, null, null, 0, 0, 0, 0, null, null);
    }

    /**
     * Returns a completed copy of this scan.
     *
     * @param completedAt        completion time
     * @param inventoryDuration  inventory duration
     * @param evaluationDuration evaluation duration
     * @param dependencies       evaluated dependencies
     * @param findings           findings produced
     * @return completed scan
     */
    public SecurityScan completed(Instant completedAt, Duration inventoryDuration, Duration evaluationDuration,
                                  List<DependencyInfo> dependencies, List<VulnerabilityFinding> findings) {
        List<DependencyInfo> deps = dependencies == null ? List.of() : dependencies;
        Collection<VulnerabilityFinding> found = findings == null ? List.of() : findings;
        Map<VulnerabilitySeverity, Integer> counts = new EnumMap<>(VulnerabilitySeverity.class);
        for (VulnerabilityFinding finding : found) {
            counts.merge(finding.severity(), 1, Integer::sum);
        }
        return new SecurityScan(id, SecurityScanStatus.COMPLETED, dataSource, startedAt, completedAt,
                inventoryDuration, evaluationDuration, deps.size(),
                count(deps, DependencyEvaluationStatus.EVALUATED),
                count(deps, DependencyEvaluationStatus.UNRESOLVED),
                found.size(), counts, null);
    }

    /**
     * Returns a failed copy of this scan.
     *
     * @param completedAt       failure time
     * @param inventoryDuration inventory duration
     * @param dependencies      inventoried dependencies
     * @param errorMessage      failure description
     * @return failed scan
     */
    public SecurityScan failed(Instant completedAt, Duration inventoryDuration,
                               List<DependencyInfo> dependencies, String errorMessage) {
        List<DependencyInfo> deps = dependencies == null ? List.of() : dependencies;
        return new SecurityScan(id, SecurityScanStatus.FAILED, dataSource, startedAt, completedAt,
                inventoryDuration, null, deps.size(), 0, count(deps, DependencyEvaluationStatus.UNRESOLVED),
                0, null, errorMessage);
    }

    private static int count(List<DependencyInfo> dependencies, DependencyEvaluationStatus status) {
        return (int) dependencies.stream().filter(d -> d.evaluationStatus() == status).count();
    }

    private static Map<VulnerabilitySeverity, Integer> normalise(Map<VulnerabilitySeverity, Integer> source) {
        Map<VulnerabilitySeverity, Integer> copy = new EnumMap<>(VulnerabilitySeverity.class);
        for (VulnerabilitySeverity severity : VulnerabilitySeverity.values()) {
            Integer value = source == null ? null : source.get(severity);
            copy.put(severity, value == null ? 0 : value);
        }
        return Collections.unmodifiableMap(copy);
    }
}
