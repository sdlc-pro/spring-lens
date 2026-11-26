package com.sdlcpro.springlens.insight.security;

import com.sdlcpro.springlens.util.Preconditions;

import java.net.URI;
import java.time.Duration;

/**
 * Settings controlling the security vulnerability scan and its data source.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 *
 * @param scanOnStartup     whether a scan is started when the application is ready
 * @param dataSourceBaseUri base URI of the vulnerability data source
 * @param requestTimeout    timeout applied to each data source request
 * @param batchSize         maximum number of packages per batch query, clamped to {@code [1, 1000]}
 */
public record SecurityScanSettings(
        boolean scanOnStartup,
        URI dataSourceBaseUri,
        Duration requestTimeout,
        int batchSize
) {

    private static final int MIN_BATCH_SIZE = 1;
    private static final int MAX_BATCH_SIZE = 1000;

    /**
     * Validates required values and clamps the batch size.
     */
    public SecurityScanSettings {
        Preconditions.notNull(dataSourceBaseUri, "SecurityScanSettings dataSourceBaseUri must not be null");
        Preconditions.notNull(requestTimeout, "SecurityScanSettings requestTimeout must not be null");
        Preconditions.isTrue(!requestTimeout.isZero() && !requestTimeout.isNegative(),
                "SecurityScanSettings requestTimeout must be positive");
        String scheme = dataSourceBaseUri.getScheme();
        Preconditions.isTrue(dataSourceBaseUri.isAbsolute() && dataSourceBaseUri.getHost() != null
                        && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)),
                "SecurityScanSettings dataSourceBaseUri must be an absolute http(s) URI");
        batchSize = Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, batchSize));
    }
}
