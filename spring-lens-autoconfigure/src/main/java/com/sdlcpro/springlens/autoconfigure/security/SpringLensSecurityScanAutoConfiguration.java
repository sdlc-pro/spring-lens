package com.sdlcpro.springlens.autoconfigure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.security.OsvVulnerabilityDataProvider;
import com.sdlcpro.springlens.insight.security.SecurityScanOrchestrator;
import com.sdlcpro.springlens.insight.security.SecurityScanSettings;
import com.sdlcpro.springlens.inspector.security.DependencyInventoryCollector;
import com.sdlcpro.springlens.inspector.security.VulnerabilityDataProvider;
import com.sdlcpro.springlens.listener.security.SecurityScanListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Role;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;

@AutoConfiguration
@SpringLensInternalComponent
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@EnableConfigurationProperties(SecurityScanProperties.class)
@ConditionalOnProperty(
        prefix = "spring.lens.security.scan",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
@Import({
        SecurityScanStorageConfiguration.class,
        SecurityScanCollectorConfiguration.class,
        SecurityScanHttpExposureConfiguration.class,
        SpringLensSecurityScanAutoConfiguration.OsvScanConfiguration.class,
        SpringLensSecurityScanAutoConfiguration.JacksonMissingConfiguration.class
})
public class SpringLensSecurityScanAutoConfiguration {

    /**
     * Reports at startup that scanning is inactive because Jackson is not on the classpath.
     */
    @SpringLensInternalComponent
    @Configuration(proxyBeanMethods = false)
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingClass("com.fasterxml.jackson.databind.ObjectMapper")
    static class JacksonMissingConfiguration {
        private static final Logger logger = LoggerFactory.getLogger(JacksonMissingConfiguration.class);

        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        static SmartInitializingSingleton securityScanInactiveNotice() {
            return () -> logger.info("Spring Lens vulnerability scanning is inactive: "
                    + "Jackson (com.fasterxml.jackson.databind.ObjectMapper) is not on the classpath");
        }
    }

    /**
     * Jackson-dependent wiring. The OSV provider and the orchestrator live together so that no
     * cross-configuration {@code @ConditionalOnBean} ordering is needed: without Jackson neither is
     * registered (a user supplied provider is then simply unused).
     */
    @SpringLensInternalComponent
    @Configuration(proxyBeanMethods = false)
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnClass(ObjectMapper.class)
    static class OsvScanConfiguration {
        private static final Logger logger = LoggerFactory.getLogger(OsvScanConfiguration.class);
        private static final URI DEFAULT_BASE_URL = URI.create("https://api.osv.dev");
        private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(10);

        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        @ConditionalOnMissingBean(VulnerabilityDataProvider.class)
        public VulnerabilityDataProvider osvVulnerabilityDataProvider(
                SecurityScanProperties properties) {
            var settings = settings(properties);
            var httpClient = HttpClient.newBuilder()
                    .connectTimeout(settings.requestTimeout())
                    .build();
            // Private mapper: application ObjectMapper beans (zero, many, customised) must not affect OSV parsing.
            return new OsvVulnerabilityDataProvider(httpClient, new ObjectMapper(), settings);
        }

        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        @ConditionalOnMissingBean(SecurityScanOrchestrator.class)
        public SecurityScanOrchestrator securityScanOrchestrator(
                SecurityScanProperties properties,
                DependencyInventoryCollector collector,
                VulnerabilityDataProvider provider,
                ObjectProvider<SecurityScanListener> listenerProvider) {
            return new SecurityScanOrchestrator(collector, provider, settings(properties), listenerProvider);
        }

        /**
         * Builds settings defensively: invalid values are replaced by defaults with a warning so that
         * misconfiguration never prevents the application from starting.
         */
        private static SecurityScanSettings settings(SecurityScanProperties properties) {
            var dataSource = properties.getDataSource();
            var timeout = dataSource.getTimeout();
            if (timeout == null || timeout.isZero() || timeout.isNegative()) {
                logger.warn("Invalid value '{}' for spring.lens.security.scan.data-source.timeout, using default {}",
                        timeout, DEFAULT_TIMEOUT);
                timeout = DEFAULT_TIMEOUT;
            }
            var baseUrl = dataSource.getBaseUrl();
            if (!isValidBaseUrl(baseUrl)) {
                logger.warn("Invalid value '{}' for spring.lens.security.scan.data-source.base-url, using default {}",
                        baseUrl, DEFAULT_BASE_URL);
                baseUrl = DEFAULT_BASE_URL;
            }
            return new SecurityScanSettings(
                    properties.isScanOnStartup(), baseUrl, timeout, dataSource.getBatchSize());
        }

        private static boolean isValidBaseUrl(URI uri) {
            if (uri == null || !uri.isAbsolute() || uri.getHost() == null) {
                return false;
            }
            return "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
        }
    }
}
