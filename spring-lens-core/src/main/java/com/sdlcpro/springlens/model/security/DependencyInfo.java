package com.sdlcpro.springlens.model.security;

import com.sdlcpro.springlens.util.Preconditions;

/**
 * Immutable description of a single dependency found on the application classpath.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 *
 * @param groupId          dependency group identifier, may be {@code null}
 * @param artifactId       dependency artifact identifier
 * @param version          dependency version, may be {@code null}
 * @param ecosystem        package ecosystem of the dependency
 * @param location         classpath location the dependency was found at, may be {@code null}
 * @param evaluationStatus evaluation outcome, defaults to {@link DependencyEvaluationStatus#NOT_EVALUATED}
 */
public record DependencyInfo(
        String groupId,
        String artifactId,
        String version,
        DependencyEcosystem ecosystem,
        String location,
        DependencyEvaluationStatus evaluationStatus
) {

    /**
     * Creates a dependency description.
     *
     * @param groupId          dependency group identifier, may be {@code null}
     * @param artifactId       dependency artifact identifier
     * @param version          dependency version, may be {@code null}
     * @param ecosystem        package ecosystem of the dependency
     * @param location         classpath location the dependency was found at, may be {@code null}
     * @param evaluationStatus evaluation outcome, {@code null} means not evaluated
     */
    public DependencyInfo {
        Preconditions.hasText(artifactId, "DependencyInfo artifactId must not be blank");
        Preconditions.notNull(ecosystem, "DependencyInfo ecosystem must not be null");
        evaluationStatus = evaluationStatus == null ? DependencyEvaluationStatus.NOT_EVALUATED : evaluationStatus;
    }

    /**
     * Returns the coordinates identifying this dependency.
     *
     * @return dependency key
     */
    public DependencyKey key() {
        return new DependencyKey(groupId, artifactId, version);
    }

    /**
     * Indicates whether both group and version are known.
     *
     * @return {@code true} when groupId and version are present
     */
    public boolean resolved() {
        return groupId != null && version != null;
    }

    /**
     * Returns a copy with the given evaluation status.
     *
     * @param status new evaluation status
     * @return copy carrying the new status
     */
    public DependencyInfo withEvaluationStatus(DependencyEvaluationStatus status) {
        return new DependencyInfo(groupId, artifactId, version, ecosystem, location, status);
    }

    /**
     * Returns the package name as used by OSV for Maven packages.
     *
     * @return {@code groupId:artifactId}
     */
    public String osvPackageName() {
        return groupId + ":" + artifactId;
    }
}
