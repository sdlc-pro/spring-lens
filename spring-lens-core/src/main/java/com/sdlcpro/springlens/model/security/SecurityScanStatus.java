package com.sdlcpro.springlens.model.security;

/**
 * Lifecycle state of a security scan.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
public enum SecurityScanStatus {
    /** The scan is in progress. */
    RUNNING,
    /** The scan finished successfully. */
    COMPLETED,
    /** The scan ended with an error. */
    FAILED
}
