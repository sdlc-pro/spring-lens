package com.sdlcpro.springlens.autoconfigure.security;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import java.net.URI;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityScanPropertiesTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfiguration.class);

    @Test
    void defaultProperties() {
        this.contextRunner.run(context -> {
            SecurityScanProperties properties = context.getBean(SecurityScanProperties.class);
            assertThat(properties.isEnabled()).isTrue();
            assertThat(properties.isScanOnStartup()).isTrue();
            assertThat(properties.getDataSource().getBaseUrl()).isEqualTo(URI.create("https://api.osv.dev"));
            assertThat(properties.getDataSource().getTimeout()).isEqualTo(Duration.ofSeconds(10));
            assertThat(properties.getDataSource().getBatchSize()).isEqualTo(500);
        });
    }

    @Test
    void customProperties() {
        this.contextRunner
                .withPropertyValues(
                        "spring.lens.security.scan.enabled=false",
                        "spring.lens.security.scan.scan-on-startup=false",
                        "spring.lens.security.scan.data-source.base-url=http://localhost:9999",
                        "spring.lens.security.scan.data-source.timeout=3s",
                        "spring.lens.security.scan.data-source.batch-size=50"
                )
                .run(context -> {
                    SecurityScanProperties properties = context.getBean(SecurityScanProperties.class);
                    assertThat(properties.isEnabled()).isFalse();
                    assertThat(properties.isScanOnStartup()).isFalse();
                    assertThat(properties.getDataSource().getBaseUrl()).isEqualTo(URI.create("http://localhost:9999"));
                    assertThat(properties.getDataSource().getTimeout()).isEqualTo(Duration.ofSeconds(3));
                    assertThat(properties.getDataSource().getBatchSize()).isEqualTo(50);
                });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(SecurityScanProperties.class)
    static class TestConfiguration {
    }
}
