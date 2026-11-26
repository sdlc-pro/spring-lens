package com.sdlcpro.springlens.model.security;

import com.sdlcpro.springlens.util.Preconditions;

/**
 * Identity of a dependency by its coordinates.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 *
 * @param groupId    dependency group identifier, may be {@code null}
 * @param artifactId dependency artifact identifier
 * @param version    dependency version, may be {@code null}
 */
public record DependencyKey(String groupId, String artifactId, String version) {

    /**
     * Creates a dependency key.
     *
     * @param groupId    dependency group identifier, may be {@code null}
     * @param artifactId dependency artifact identifier
     * @param version    dependency version, may be {@code null}
     */
    public DependencyKey {
        Preconditions.hasText(artifactId, "DependencyKey artifactId must not be blank");
    }
}
