package com.sdlcpro.springlens.exposure.security;

import com.sdlcpro.springlens.annotation.SpringLensEndpoint;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exception.DataNotFoundException;
import com.sdlcpro.springlens.exposure.ApiResponseHandler;
import com.sdlcpro.springlens.model.security.DependencyEvaluationStatus;
import com.sdlcpro.springlens.model.security.VulnerabilitySeverity;
import com.sdlcpro.springlens.model.security.VulnerabilitySummary;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.Sort;
import com.sdlcpro.springlens.repository.security.DependencyInfoRepository;
import com.sdlcpro.springlens.repository.security.SecurityScanRepository;
import com.sdlcpro.springlens.repository.security.VulnerabilityFindingRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

import static com.sdlcpro.springlens.query.Filters.*;

/**
 * REST controller that exposes dependency vulnerability scan results collected
 * by Spring Lens.
 *
 * <p>Requested page sizes are constrained to {@value #MAX_PAGE_SIZE} so an HTTP
 * client cannot request an unbounded response.</p>
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@RestController
@SpringLensEndpoint
@SpringLensInternalComponent
@RequestMapping("/spring-lens/api/security")
public class SecurityRestController {

    private static final int MAX_PAGE_SIZE = 1000;
    private static final String NO_SCAN_MESSAGE = "No security scan has been executed yet";

    private final SecurityScanRepository securityScanRepository;
    private final DependencyInfoRepository dependencyInfoRepository;
    private final VulnerabilityFindingRepository vulnerabilityFindingRepository;

    /**
     * Creates a controller backed by the supplied security repositories.
     *
     * @param securityScanRepository         repository holding scan executions
     * @param dependencyInfoRepository       repository holding the dependency inventory
     * @param vulnerabilityFindingRepository repository holding vulnerability findings
     */
    public SecurityRestController(SecurityScanRepository securityScanRepository,
                                  DependencyInfoRepository dependencyInfoRepository,
                                  VulnerabilityFindingRepository vulnerabilityFindingRepository) {
        this.securityScanRepository = securityScanRepository;
        this.dependencyInfoRepository = dependencyInfoRepository;
        this.vulnerabilityFindingRepository = vulnerabilityFindingRepository;
    }

    /**
     * Returns a filtered page of vulnerability findings.
     *
     * @param severity   optional severity (case-insensitive)
     * @param groupId    optional dependency group identifier
     * @param artifactId optional dependency artifact identifier
     * @param search     optional case-insensitive search over vulnerability id,
     *                   summary and dependency artifact id
     * @param pageNumber zero-based page index
     * @param pageSize   page size, capped at {@value #MAX_PAGE_SIZE}
     * @param sortBy     sort property; defaults to {@code severity}
     * @param sortDir    {@code ASC} or {@code DESC}
     * @return an HTTP response containing a page of findings
     */
    @GetMapping(value = "/vulnerabilities", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getVulnerabilities(
            @RequestParam(value = "severity", required = false) String severity,
            @RequestParam(value = "groupId", required = false) String groupId,
            @RequestParam(value = "artifactId", required = false) String artifactId,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "pageNumber", defaultValue = "0") int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "10") int pageSize,
            @RequestParam(value = "sortBy", defaultValue = "severity") String sortBy,
            @RequestParam(value = "sortDir", defaultValue = "ASC") String sortDir) {
        var pageRequest = pageRequest(pageNumber, pageSize, sortBy, sortDir);

        return ApiResponseHandler.handle(() -> {
            var filter = and(
                    eqIfPresent("severity", severity, SecurityRestController::parseSeverity),
                    eqIfPresent("dependency.groupId", groupId),
                    eqIfPresent("dependency.artifactId", artifactId),
                    orIfPresent(
                            search,
                            containsIgnoreCaseIfPresent("vulnerabilityId", search),
                            containsIgnoreCaseIfPresent("summary", search),
                            containsIgnoreCaseIfPresent("dependency.artifactId", search))
            );

            return vulnerabilityFindingRepository.findAll(filter, pageRequest);
        });
    }

    /**
     * Returns the aggregated vulnerability summary of the latest scan.
     *
     * @return the summary, or {@code 404 Not Found} when no scan has run
     */
    @GetMapping(value = "/vulnerabilities/summary", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getSummary() {
        return ApiResponseHandler.handle(() -> {
            var scan = securityScanRepository.findLatest()
                    .orElseThrow(() -> new DataNotFoundException(NO_SCAN_MESSAGE));
            return VulnerabilitySummary.from(scan, vulnerabilityFindingRepository.findAll());
        }, NO_SCAN_MESSAGE);
    }

    /**
     * Returns a filtered page of inventoried dependencies.
     *
     * @param groupId          optional group identifier
     * @param artifactId       optional artifact identifier
     * @param evaluationStatus optional evaluation status (case-insensitive)
     * @param search           optional case-insensitive search over group and artifact id
     * @param pageNumber       zero-based page index
     * @param pageSize         page size, capped at {@value #MAX_PAGE_SIZE}
     * @param sortBy           sort property; defaults to {@code artifactId}
     * @param sortDir          {@code ASC} or {@code DESC}
     * @return an HTTP response containing a page of dependencies
     */
    @GetMapping(value = "/dependencies", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getDependencies(
            @RequestParam(value = "groupId", required = false) String groupId,
            @RequestParam(value = "artifactId", required = false) String artifactId,
            @RequestParam(value = "evaluationStatus", required = false) String evaluationStatus,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "pageNumber", defaultValue = "0") int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "10") int pageSize,
            @RequestParam(value = "sortBy", defaultValue = "artifactId") String sortBy,
            @RequestParam(value = "sortDir", defaultValue = "ASC") String sortDir) {
        var pageRequest = pageRequest(pageNumber, pageSize, sortBy, sortDir);

        return ApiResponseHandler.handle(() -> {
            var filter = and(
                    eqIfPresent("groupId", groupId),
                    eqIfPresent("artifactId", artifactId),
                    eqIfPresent("evaluationStatus", evaluationStatus, SecurityRestController::parseStatus),
                    orIfPresent(
                            search,
                            containsIgnoreCaseIfPresent("groupId", search),
                            containsIgnoreCaseIfPresent("artifactId", search))
            );

            return dependencyInfoRepository.findAll(filter, pageRequest);
        });
    }

    /**
     * Returns the most recent security scan.
     *
     * @return the latest scan, or {@code 404 Not Found} when no scan has run
     */
    @GetMapping(value = "/scans/latest", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getLatestScan() {
        return ApiResponseHandler.handle(() -> securityScanRepository.findLatest().orElse(null), NO_SCAN_MESSAGE);
    }

    private static PageRequest pageRequest(int pageNumber, int pageSize, String sortBy, String sortDir) {
        return new PageRequest(
                Math.max(pageNumber, 0),
                Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE),
                Sort.by(sortBy, sortDir)
        );
    }

    private static VulnerabilitySeverity parseSeverity(String value) {
        return VulnerabilitySeverity.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    private static DependencyEvaluationStatus parseStatus(String value) {
        return DependencyEvaluationStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
