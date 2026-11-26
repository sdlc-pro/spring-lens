package com.sdlcpro.springlens.insight.security;

import java.util.HashMap;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.Set;

/**
 * Computes the CVSS v3.0/v3.1 base score from a vector string using the public CVSS v3.1 formula.
 * Temporal and environmental metrics are ignored. Malformed or unsupported vectors yield an empty result.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
final class CvssV3BaseScoreCalculator {

    private static final Set<String> BASE_METRICS = Set.of("AV", "AC", "PR", "UI", "S", "C", "I", "A");

    private CvssV3BaseScoreCalculator() {
        throw new UnsupportedOperationException("CvssV3BaseScoreCalculator is an utility class and cannot be instantiated");
    }

    static OptionalDouble calculate(String vector) {
        if (vector == null) {
            return OptionalDouble.empty();
        }
        String[] parts = vector.split("/");
        if (parts.length == 0 || !("CVSS:3.0".equals(parts[0]) || "CVSS:3.1".equals(parts[0]))) {
            return OptionalDouble.empty();
        }
        Map<String, String> metrics = new HashMap<>();
        for (int i = 1; i < parts.length; i++) {
            int colon = parts[i].indexOf(':');
            if (colon <= 0 || colon == parts[i].length() - 1) {
                return OptionalDouble.empty();
            }
            String key = parts[i].substring(0, colon);
            if (metrics.put(key, parts[i].substring(colon + 1)) != null) {
                return OptionalDouble.empty();
            }
        }
        if (!metrics.keySet().containsAll(BASE_METRICS)) {
            return OptionalDouble.empty();
        }

        String scope = metrics.get("S");
        boolean changed;
        if ("U".equals(scope)) {
            changed = false;
        } else if ("C".equals(scope)) {
            changed = true;
        } else {
            return OptionalDouble.empty();
        }

        double av = weight(metrics.get("AV"), "N", 0.85, "A", 0.62, "L", 0.55, "P", 0.2);
        double ac = weight(metrics.get("AC"), "L", 0.77, "H", 0.44);
        double pr = changed
                ? weight(metrics.get("PR"), "N", 0.85, "L", 0.68, "H", 0.5)
                : weight(metrics.get("PR"), "N", 0.85, "L", 0.62, "H", 0.27);
        double ui = weight(metrics.get("UI"), "N", 0.85, "R", 0.62);
        double c = weight(metrics.get("C"), "H", 0.56, "L", 0.22, "N", 0.0);
        double i = weight(metrics.get("I"), "H", 0.56, "L", 0.22, "N", 0.0);
        double a = weight(metrics.get("A"), "H", 0.56, "L", 0.22, "N", 0.0);
        if (Double.isNaN(av + ac + pr + ui + c + i + a)) {
            return OptionalDouble.empty();
        }

        double iss = 1 - (1 - c) * (1 - i) * (1 - a);
        double impact = changed
                ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
                : 6.42 * iss;
        double exploitability = 8.22 * av * ac * pr * ui;
        if (impact <= 0) {
            return OptionalDouble.of(0.0);
        }
        double base = changed ? 1.08 * (impact + exploitability) : impact + exploitability;
        return OptionalDouble.of(roundUp(Math.min(base, 10)));
    }

    private static double weight(String value, Object... pairs) {
        for (int k = 0; k < pairs.length; k += 2) {
            if (pairs[k].equals(value)) {
                return (double) pairs[k + 1];
            }
        }
        return Double.NaN;
    }

    private static double roundUp(double value) {
        int intInput = (int) Math.round(value * 100000);
        if (intInput % 10000 == 0) {
            return intInput / 100000.0;
        }
        return (Math.floor(intInput / 10000.0) + 1) / 10.0;
    }
}
