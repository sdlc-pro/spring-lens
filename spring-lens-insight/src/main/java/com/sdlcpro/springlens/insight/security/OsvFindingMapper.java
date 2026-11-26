package com.sdlcpro.springlens.insight.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.VulnerabilityFinding;
import com.sdlcpro.springlens.model.security.VulnerabilitySeverity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalDouble;

/**
 * Maps an OSV vulnerability document to a {@link VulnerabilityFinding} for a given dependency.
 * Missing optional fields never cause failures; only a missing {@code id} is rejected.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
public class OsvFindingMapper {

    private static final String OSV_PAGE = "https://osv.dev/vulnerability/";

    /**
     * Maps an OSV vulnerability document.
     *
     * @param vuln       OSV vulnerability JSON
     * @param dependency dependency the vulnerability was reported for
     * @return mapped finding
     * @throws IllegalArgumentException when the document has no {@code id}
     */
    public VulnerabilityFinding map(JsonNode vuln, DependencyInfo dependency) {
        String id = text(vuln, "id");
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("OSV vulnerability must have an id");
        }
        String vector = cvssVector(vuln);
        Double score = null;
        if (vector != null) {
            OptionalDouble calculated = CvssV3BaseScoreCalculator.calculate(vector);
            score = calculated.isPresent() ? calculated.getAsDouble() : null;
        }
        List<String> fixed = new ArrayList<>();
        String range = affectedRange(vuln, dependency.osvPackageName(), fixed);
        return new VulnerabilityFinding(
                id,
                aliases(vuln),
                dependency.key(),
                text(vuln, "summary"),
                severity(vuln, score),
                score,
                vector,
                range,
                fixed,
                referenceUrl(vuln, id),
                instant(vuln, "published"),
                instant(vuln, "modified"));
    }

    private static VulnerabilitySeverity severity(JsonNode vuln, Double score) {
        String label = text(vuln.path("database_specific"), "severity");
        if (label != null && !label.isBlank()) {
            VulnerabilitySeverity fromLabel = VulnerabilitySeverity.fromLabel(label);
            if (fromLabel != VulnerabilitySeverity.UNKNOWN) {
                return fromLabel;
            }
        }
        return score != null ? VulnerabilitySeverity.fromCvssBaseScore(score) : VulnerabilitySeverity.UNKNOWN;
    }

    private static String cvssVector(JsonNode vuln) {
        for (JsonNode s : vuln.path("severity")) {
            if ("CVSS_V3".equals(text(s, "type"))) {
                String score = text(s, "score");
                if (score != null) {
                    return score;
                }
            }
        }
        return null;
    }

    private static List<String> aliases(JsonNode vuln) {
        List<String> aliases = new ArrayList<>();
        for (JsonNode a : vuln.path("aliases")) {
            if (a.isTextual()) {
                aliases.add(a.asText());
            }
        }
        return aliases;
    }

    private static String referenceUrl(JsonNode vuln, String id) {
        String first = null;
        for (JsonNode ref : vuln.path("references")) {
            String url = text(ref, "url");
            if (url == null) {
                continue;
            }
            if ("ADVISORY".equals(text(ref, "type"))) {
                return url;
            }
            if (first == null) {
                first = url;
            }
        }
        return first != null ? first : OSV_PAGE + id;
    }

    private static String affectedRange(JsonNode vuln, String packageName, List<String> fixed) {
        List<String> ranges = new ArrayList<>();
        for (JsonNode affected : vuln.path("affected")) {
            if (!packageName.equals(text(affected.path("package"), "name"))) {
                continue;
            }
            for (JsonNode range : affected.path("ranges")) {
                if (!"ECOSYSTEM".equals(text(range, "type"))) {
                    continue;
                }
                List<String> parts = new ArrayList<>();
                for (JsonNode event : range.path("events")) {
                    String introduced = text(event, "introduced");
                    String fix = text(event, "fixed");
                    String last = text(event, "last_affected");
                    if (introduced != null) {
                        parts.add(">=" + introduced);
                    }
                    if (fix != null) {
                        parts.add("<" + fix);
                        if (!fixed.contains(fix)) {
                            fixed.add(fix);
                        }
                    }
                    if (last != null) {
                        parts.add("<=" + last);
                    }
                }
                if (!parts.isEmpty()) {
                    ranges.add(String.join(", ", parts));
                }
            }
        }
        return ranges.isEmpty() ? null : String.join(" | ", ranges);
    }

    private static Instant instant(JsonNode node, String field) {
        String value = text(node, field);
        if (value == null) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() ? value.asText() : null;
    }
}
