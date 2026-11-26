package com.sdlcpro.springlens.exposure.security;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.sdlcpro.springlens.model.security.DependencyEcosystem;
import com.sdlcpro.springlens.model.security.DependencyEvaluationStatus;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.VulnerabilityFinding;
import com.sdlcpro.springlens.model.security.VulnerabilitySeverity;
import com.sdlcpro.springlens.storage.security.InMemoryDependencyInfoRepository;
import com.sdlcpro.springlens.storage.security.InMemorySecurityScanRepository;
import com.sdlcpro.springlens.storage.security.InMemoryVulnerabilityFindingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the HTTP exposure of security vulnerability scan data.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@DisplayName("SecurityRestController Tests")
class SecurityRestControllerTest {

    private static final String NO_SCAN = "No security scan has been executed yet";

    private final InMemorySecurityScanRepository scanRepository = new InMemorySecurityScanRepository();
    private final InMemoryDependencyInfoRepository dependencyRepository = new InMemoryDependencyInfoRepository();
    private final InMemoryVulnerabilityFindingRepository findingRepository = new InMemoryVulnerabilityFindingRepository();

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new SecurityRestController(scanRepository, dependencyRepository, findingRepository))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper()))
                .build();
    }

    @Test
    @DisplayName("vulnerabilities returns paged findings")
    void vulnerabilitiesReturnsPagedFindings() throws Exception {
        seedFindings();

        mockMvc.perform(get("/spring-lens/api/security/vulnerabilities").param("pageSize", "2")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].severity").value("CRITICAL"));
    }

    @Test
    @DisplayName("vulnerabilities filters by severity and groupId")
    void vulnerabilitiesFiltersBySeverityAndGroupId() throws Exception {
        seedFindings();

        mockMvc.perform(get("/spring-lens/api/security/vulnerabilities")
                        .param("severity", "high").param("groupId", "org.yaml"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].vulnerabilityId").value("CVE-2"));
    }

    @Test
    @DisplayName("vulnerabilities search matches summary text")
    void vulnerabilitiesSearch() throws Exception {
        seedFindings();

        mockMvc.perform(get("/spring-lens/api/security/vulnerabilities").param("search", "jackson"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].vulnerabilityId").value("CVE-1"));
    }

    @Test
    @DisplayName("vulnerabilities rejects unknown severity with 400")
    void vulnerabilitiesRejectsUnknownSeverityWith400() throws Exception {
        mockMvc.perform(get("/spring-lens/api/security/vulnerabilities").param("severity", "BOGUS"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("summary returns 404 before first scan")
    void summaryReturns404BeforeFirstScan() throws Exception {
        mockMvc.perform(get("/spring-lens/api/security/vulnerabilities/summary"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(NO_SCAN));
    }

    @Test
    @DisplayName("summary aggregates latest scan and findings")
    void summaryAggregatesLatestScanAndFindings() throws Exception {
        seedFindings();
        seedScans();

        mockMvc.perform(get("/spring-lens/api/security/vulnerabilities/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scanStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.totalFindings").value(3))
                .andExpect(jsonPath("$.vulnerableDependencies").value(2))
                .andExpect(jsonPath("$.findingsBySeverity.CRITICAL").value(1))
                .andExpect(jsonPath("$.findingsBySeverity.HIGH").value(1))
                .andExpect(jsonPath("$.findingsBySeverity.MEDIUM").value(1))
                .andExpect(jsonPath("$.findingsBySeverity.LOW").value(0));
    }

    @Test
    @DisplayName("dependencies filters by evaluation status")
    void dependenciesFiltersByEvaluationStatus() throws Exception {
        seedDependencies();

        mockMvc.perform(get("/spring-lens/api/security/dependencies").param("evaluationStatus", "UNRESOLVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].artifactId").value("tools"));
    }

    @Test
    @DisplayName("dependencies rejects unknown evaluation status with 400")
    void dependenciesRejectsUnknownStatus() throws Exception {
        mockMvc.perform(get("/spring-lens/api/security/dependencies").param("evaluationStatus", "BOGUS"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("latest scan returns most recent")
    void latestScanReturnsMostRecent() throws Exception {
        seedScans();

        mockMvc.perform(get("/spring-lens/api/security/scans/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("scan-2"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.findingCountBySeverity.HIGH").value(2));
    }

    @Test
    @DisplayName("latest scan returns 404 when none")
    void latestScanReturns404WhenNone() throws Exception {
        mockMvc.perform(get("/spring-lens/api/security/scans/latest"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(NO_SCAN));
    }

    private void seedFindings() {
        findingRepository.save(finding("CVE-1", "com.fasterxml.jackson.core", "jackson-databind",
                VulnerabilitySeverity.CRITICAL, "Jackson deserialization flaw"));
        findingRepository.save(finding("CVE-2", "org.yaml", "snakeyaml", VulnerabilitySeverity.HIGH, "YAML flaw"));
        findingRepository.save(finding("CVE-3", "org.yaml", "snakeyaml", VulnerabilitySeverity.MEDIUM, "Other flaw"));
    }

    private VulnerabilityFinding finding(String id, String group, String artifact,
                                         VulnerabilitySeverity severity, String summary) {
        return new VulnerabilityFinding(id, null, new DependencyKey(group, artifact, "1.0"), summary,
                severity, null, null, null, null, null, null, null);
    }

    private void seedDependencies() {
        dependencyRepository.save(new DependencyInfo("org.yaml", "snakeyaml", "1.0",
                DependencyEcosystem.MAVEN, "a.jar", DependencyEvaluationStatus.EVALUATED));
        dependencyRepository.save(new DependencyInfo(null, "tools", null,
                DependencyEcosystem.MAVEN, "tools.jar", DependencyEvaluationStatus.UNRESOLVED));
    }

    private void seedScans() {
        var first = SecurityScan.running("scan-1", "osv", Instant.parse("2026-11-26T09:00:00Z"));
        scanRepository.save(first);
        var second = SecurityScan.running("scan-2", "osv", Instant.parse("2026-11-26T10:00:00Z"))
                .completed(Instant.parse("2026-11-26T10:01:00Z"), Duration.ofMillis(5), Duration.ofMillis(10),
                        List.of(), List.of(
                                finding("CVE-1", "g", "a", VulnerabilitySeverity.HIGH, "s"),
                                finding("CVE-2", "g", "b", VulnerabilitySeverity.HIGH, "s"),
                                finding("CVE-3", "g", "b", VulnerabilitySeverity.LOW, "s")));
        scanRepository.save(second);
    }

    private ObjectMapper objectMapper() {
        var module = new SimpleModule();
        module.addSerializer(Instant.class, stringSerializer());
        module.addSerializer(Duration.class, stringSerializer());
        return new ObjectMapper().registerModule(module);
    }

    private <T> JsonSerializer<T> stringSerializer() {
        return new JsonSerializer<>() {
            @Override
            public void serialize(T value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
                gen.writeString(value.toString());
            }
        };
    }
}
