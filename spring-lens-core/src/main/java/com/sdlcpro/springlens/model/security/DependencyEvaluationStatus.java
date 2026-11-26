package com.sdlcpro.springlens.model.security;

/**
 * Outcome of evaluating a dependency against a vulnerability database.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
public enum DependencyEvaluationStatus {
    /** The dependency has not been evaluated yet. */
    NOT_EVALUATED,
    /** The dependency was evaluated successfully. */
    EVALUATED,
    /** The dependency could not be resolved to full coordinates. */
    UNRESOLVED
}
