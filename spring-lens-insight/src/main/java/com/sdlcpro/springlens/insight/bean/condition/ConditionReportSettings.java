package com.sdlcpro.springlens.insight.bean.condition;

import com.sdlcpro.springlens.util.DefensiveCopies;

import java.util.Collection;
import java.util.Set;

/**
 * Encapsulates evaluation settings for condition report collection, controlling whether
 * tool-internal components should be included and providing package pattern exclusion rules.
 *
 * <p>By leveraging {@link DefensiveCopies#immutableSetOrEmpty(Collection)} (Set)}, this record maintains
 * strict defensive immutability for thread-safe evaluation across condition matching pipelines.</p>
 *
 * @param includeToolInternal    whether to include SpringLens internal framework components
 *                               in evaluation reports
 * @param excludePackagePatterns set of package name patterns to exclude from evaluation;
 *                               defensively copied and immutable
 * @since 1.0.0
 */
public record ConditionReportSettings(
        boolean includeToolInternal,
        Set<String> excludePackagePatterns,
        boolean excludeFrameworkInternal
) {

    /**
     * Compact constructor that ensures {@code excludePackagePatterns} is defensibly copied
     * and immutable.
     */
    public ConditionReportSettings {
        excludePackagePatterns = DefensiveCopies.immutableSetOrEmpty(excludePackagePatterns);
    }
}
