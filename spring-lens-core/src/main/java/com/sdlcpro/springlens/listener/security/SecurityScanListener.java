package com.sdlcpro.springlens.listener.security;

import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.SecurityScanResult;

/**
 * Listener interface that receives security scan lifecycle notifications.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
public interface SecurityScanListener {

    /**
     * Invoked when a scan starts.
     *
     * @param scan the running scan
     */
    default void onSecurityScanStarted(SecurityScan scan) {
    }

    /**
     * Invoked when a scan finishes, for both {@code COMPLETED} and {@code FAILED} scans.
     *
     * @param result the scan outcome
     */
    void onSecurityScanCompleted(SecurityScanResult result);
}
