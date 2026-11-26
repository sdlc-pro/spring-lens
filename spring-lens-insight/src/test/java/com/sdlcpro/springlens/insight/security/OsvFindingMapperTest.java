package com.sdlcpro.springlens.insight.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sdlcpro.springlens.model.security.DependencyEcosystem;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import com.sdlcpro.springlens.model.security.VulnerabilityFinding;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;

import static com.sdlcpro.springlens.model.security.VulnerabilitySeverity.CRITICAL;
import static com.sdlcpro.springlens.model.security.VulnerabilitySeverity.HIGH;
import static com.sdlcpro.springlens.model.security.VulnerabilitySeverity.UNKNOWN;
import static org.assertj.core.api.Assertions.assertThat;

class OsvFindingMapperTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final OsvFindingMapper mapper = new OsvFindingMapper();
    private final DependencyInfo snakeyaml133 =
            new DependencyInfo("org.yaml", "snakeyaml", "1.33", DependencyEcosystem.MAVEN, null, null);

    @Test
    void mapsSnakeyamlAdvisory() {
        VulnerabilityFinding f = mapper.map(load("osv/GHSA-mjmj-j48q-9wg2.json"), snakeyaml133);

        assertThat(f.vulnerabilityId()).isEqualTo("GHSA-mjmj-j48q-9wg2");
        assertThat(f.aliases()).containsExactly("CVE-2022-1471");
        assertThat(f.dependency()).isEqualTo(new DependencyKey("org.yaml", "snakeyaml", "1.33"));
        assertThat(f.summary()).isEqualTo("SnakeYaml Constructor Deserialization Remote Code Execution");
        assertThat(f.severity()).isEqualTo(HIGH);
        assertThat(f.cvssScore()).isEqualTo(8.3);
        assertThat(f.cvssVector()).isEqualTo("CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:L");
        assertThat(f.affectedVersionRange()).isEqualTo(">=0, <2.0");
        assertThat(f.fixedVersions()).containsExactly("2.0");
        assertThat(f.referenceUrl()).isEqualTo("https://nvd.nist.gov/vuln/detail/CVE-2022-1471");
        assertThat(f.publishedAt()).isEqualTo(Instant.parse("2022-12-12T21:19:47Z"));
        assertThat(f.modifiedAt()).isEqualTo(Instant.parse("2026-09-10T03:49:50.365884036Z"));
    }

    @Test
    void severityFallsBackToCvssScoreWhenLabelMissing() {
        VulnerabilityFinding f = mapper.map(json("""
                {"id":"GHSA-x","severity":[{"type":"CVSS_V3","score":"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"}]}
                """), snakeyaml133);

        assertThat(f.severity()).isEqualTo(CRITICAL);
        assertThat(f.cvssScore()).isEqualTo(9.8);
    }

    @Test
    void severityIsUnknownWhenNeitherLabelNorVectorPresent() {
        VulnerabilityFinding f = mapper.map(json("{\"id\":\"GHSA-x\"}"), snakeyaml133);

        assertThat(f.severity()).isEqualTo(UNKNOWN);
        assertThat(f.cvssScore()).isNull();
        assertThat(f.cvssVector()).isNull();
    }

    @Test
    void referenceUrlFallsBackToFirstReferenceThenOsvPage() {
        VulnerabilityFinding withRefs = mapper.map(json("""
                {"id":"GHSA-x","references":[{"type":"WEB","url":"https://a.example"},{"type":"WEB","url":"https://b.example"}]}
                """), snakeyaml133);
        VulnerabilityFinding none = mapper.map(json("{\"id\":\"GHSA-x\"}"), snakeyaml133);

        assertThat(withRefs.referenceUrl()).isEqualTo("https://a.example");
        assertThat(none.referenceUrl()).isEqualTo("https://osv.dev/vulnerability/GHSA-x");
    }

    @Test
    void affectedRangeUsesOnlyEntryMatchingPackageName() {
        VulnerabilityFinding f = mapper.map(json("""
                {"id":"GHSA-x","affected":[
                  {"package":{"name":"org.other:lib","ecosystem":"Maven"},
                   "ranges":[{"type":"ECOSYSTEM","events":[{"introduced":"5"},{"fixed":"6"}]}]},
                  {"package":{"name":"org.yaml:snakeyaml","ecosystem":"Maven"},
                   "ranges":[{"type":"ECOSYSTEM","events":[{"introduced":"1.0"}]}]}
                ]}
                """), snakeyaml133);

        assertThat(f.affectedVersionRange()).isEqualTo(">=1.0");
        assertThat(f.fixedVersions()).isEmpty();
    }

    @Test
    void lastAffectedEventRendersAsLessOrEqual() {
        VulnerabilityFinding f = mapper.map(json("""
                {"id":"GHSA-x","affected":[
                  {"package":{"name":"org.yaml:snakeyaml","ecosystem":"Maven"},
                   "ranges":[{"type":"ECOSYSTEM","events":[{"introduced":"0"},{"last_affected":"1.33"}]}]}
                ]}
                """), snakeyaml133);

        assertThat(f.affectedVersionRange()).isEqualTo(">=0, <=1.33");
        assertThat(f.fixedVersions()).isEmpty();
    }

    @Test
    void unparseableTimestampsBecomeNull() {
        VulnerabilityFinding f = mapper.map(json("{\"id\":\"GHSA-x\",\"published\":\"nope\"}"), snakeyaml133);

        assertThat(f.publishedAt()).isNull();
        assertThat(f.modifiedAt()).isNull();
    }

    private static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static JsonNode load(String resource) {
        try (InputStream in = OsvFindingMapperTest.class.getClassLoader().getResourceAsStream(resource)) {
            return JSON.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
