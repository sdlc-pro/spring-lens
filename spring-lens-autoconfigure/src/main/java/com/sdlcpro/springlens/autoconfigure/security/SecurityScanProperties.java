package com.sdlcpro.springlens.autoconfigure.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.time.Duration;

/**
 * Configuration properties for dependency vulnerability scanning.
 * Externalized configuration property bindings under the spring.lens.security.scan prefix.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
@ConfigurationProperties(prefix = "spring.lens.security.scan")
public class SecurityScanProperties {
    private boolean enabled = true;
    private boolean scanOnStartup = true;
    private final DataSource dataSource = new DataSource();

    /**
     * @return whether security scanning is enabled
     */
    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * @return whether a scan is started once the application is ready
     */
    public boolean isScanOnStartup() {
        return scanOnStartup;
    }

    public void setScanOnStartup(boolean scanOnStartup) {
        this.scanOnStartup = scanOnStartup;
    }

    /**
     * @return vulnerability data source configuration
     */
    public DataSource getDataSource() {
        return dataSource;
    }

    /**
     * Defines bindings for the data-source block under spring.lens.security.scan.data-source
     */
    public static final class DataSource {
        private URI baseUrl = URI.create("https://api.osv.dev");
        private Duration timeout = Duration.ofSeconds(10);
        private int batchSize = 500;

        /**
         * @return base URL of the vulnerability data source
         */
        public URI getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(URI baseUrl) {
            this.baseUrl = baseUrl;
        }

        /**
         * @return request timeout
         */
        public Duration getTimeout() {
            return timeout;
        }

        public void setTimeout(Duration timeout) {
            this.timeout = timeout;
        }

        /**
         * @return maximum number of dependencies per query batch
         */
        public int getBatchSize() {
            return batchSize;
        }

        public void setBatchSize(int batchSize) {
            this.batchSize = batchSize;
        }
    }
}
