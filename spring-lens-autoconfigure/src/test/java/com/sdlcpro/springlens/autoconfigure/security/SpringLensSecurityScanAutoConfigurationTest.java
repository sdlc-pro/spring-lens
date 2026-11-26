package com.sdlcpro.springlens.autoconfigure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sdlcpro.springlens.exposure.security.SecurityRestController;
import com.sdlcpro.springlens.insight.security.OsvVulnerabilityDataProvider;
import com.sdlcpro.springlens.insight.security.SecurityScanOrchestrator;
import com.sdlcpro.springlens.inspector.security.DependencyInventoryCollector;
import com.sdlcpro.springlens.inspector.security.VulnerabilityDataProvider;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.SecurityScanStatus;
import com.sdlcpro.springlens.model.security.VulnerabilityFinding;
import com.sdlcpro.springlens.model.security.VulnerabilitySeverity;
import com.sdlcpro.springlens.repository.security.DependencyInfoRepository;
import com.sdlcpro.springlens.repository.security.SecurityScanRepository;
import com.sdlcpro.springlens.repository.security.VulnerabilityFindingRepository;
import com.sdlcpro.springlens.storage.security.SecurityScanPersistenceHandler;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SpringLensSecurityScanAutoConfigurationTest {

    private final WebApplicationContextRunner runner = new WebApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SpringLensSecurityScanAutoConfiguration.class))
            .withPropertyValues("spring.lens.security.scan.scan-on-startup=false");

    @Test
    void registersFeatureBeansByDefault() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(DependencyInventoryCollector.class);
            assertThat(context).hasSingleBean(VulnerabilityDataProvider.class);
            assertThat(context.getBean(VulnerabilityDataProvider.class)).isInstanceOf(OsvVulnerabilityDataProvider.class);
            assertThat(context).hasSingleBean(SecurityScanOrchestrator.class);
            assertThat(context).hasSingleBean(SecurityScanRepository.class);
            assertThat(context).hasSingleBean(DependencyInfoRepository.class);
            assertThat(context).hasSingleBean(VulnerabilityFindingRepository.class);
            assertThat(context).hasSingleBean(SecurityScanPersistenceHandler.class);
            assertThat(context).hasSingleBean(SecurityRestController.class);
        });
    }

    @Test
    void disablesWhenPropertyFalse() {
        runner.withPropertyValues("spring.lens.security.scan.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(DependencyInventoryCollector.class);
                    assertThat(context).doesNotHaveBean(VulnerabilityDataProvider.class);
                    assertThat(context).doesNotHaveBean(SecurityScanOrchestrator.class);
                    assertThat(context).doesNotHaveBean(SecurityScanRepository.class);
                    assertThat(context).doesNotHaveBean(DependencyInfoRepository.class);
                    assertThat(context).doesNotHaveBean(VulnerabilityFindingRepository.class);
                    assertThat(context).doesNotHaveBean(SecurityScanPersistenceHandler.class);
                    assertThat(context).doesNotHaveBean(SecurityRestController.class);
                });
    }

    @Test
    void userProvidedProviderBacksOffDefault() {
        runner.withUserConfiguration(StubProviderConfig.class)
                .run(context -> {
                    assertThat(context).hasSingleBean(VulnerabilityDataProvider.class);
                    assertThat(context.getBean(VulnerabilityDataProvider.class)).isInstanceOf(StubProvider.class);
                });
    }

    @Test
    void noControllerWithoutServletWebApplication() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensSecurityScanAutoConfiguration.class))
                .withPropertyValues("spring.lens.security.scan.scan-on-startup=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(SecurityRestController.class);
                    assertThat(context).hasSingleBean(SecurityScanOrchestrator.class);
                });
    }

    @Test
    void noProviderOrOrchestratorWithoutJackson() {
        runner.withClassLoader(new FilteredClassLoader(ObjectMapper.class))
                .run(context -> {
                    assertThat(context).doesNotHaveBean(VulnerabilityDataProvider.class);
                    assertThat(context).doesNotHaveBean(SecurityScanOrchestrator.class);
                    assertThat(context).hasSingleBean(SecurityRestController.class);
                });
    }

    @Test
    void multipleObjectMapperBeansWithoutPrimaryDoNotFailStartup() {
        runner.withUserConfiguration(TwoObjectMappersConfig.class)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(VulnerabilityDataProvider.class);
                });
    }

    @Test
    void invalidDataSourcePropertiesDoNotFailStartup() {
        for (String invalid : List.of(
                "spring.lens.security.scan.data-source.timeout=0s",
                "spring.lens.security.scan.data-source.timeout=-1s",
                "spring.lens.security.scan.data-source.base-url=ftp://x",
                "spring.lens.security.scan.data-source.base-url=not-a-uri-relative")) {
            runner.withPropertyValues(invalid).run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context).hasSingleBean(VulnerabilityDataProvider.class);
                assertThat(context).hasSingleBean(SecurityScanOrchestrator.class);
            });
        }
    }

    @Test
    void endToEndScanWithStubProviderStoresFindings() {
        runner.withUserConfiguration(StubProviderConfig.class)
                .run(context -> {
                    var result = context.getBean(SecurityScanOrchestrator.class).scan();
                    assertThat(result.scan().status()).isEqualTo(SecurityScanStatus.COMPLETED);
                    assertThat(context.getBean(SecurityScanRepository.class).findLatest())
                            .map(SecurityScan::id).contains(result.scan().id());
                    assertThat(context.getBean(VulnerabilityFindingRepository.class).count()).isEqualTo(1);
                    assertThat(context.getBean(DependencyInfoRepository.class).count())
                            .isEqualTo(result.dependencies().size()).isPositive();
                });
    }

    static class StubProvider implements VulnerabilityDataProvider {
        @Override
        public String name() {
            return "stub";
        }

        @Override
        public List<VulnerabilityFinding> findVulnerabilities(Collection<DependencyInfo> dependencies) {
            DependencyInfo first = dependencies.iterator().next();
            return List.of(new VulnerabilityFinding("STUB-1", List.of(), first.key(), "stub finding",
                    VulnerabilitySeverity.HIGH, null, null, null, List.of(), null, null, null));
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class StubProviderConfig {
        @Bean
        VulnerabilityDataProvider stubProvider() {
            return new StubProvider();
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class TwoObjectMappersConfig {
        @Bean
        ObjectMapper firstMapper() {
            return new ObjectMapper();
        }

        @Bean
        ObjectMapper secondMapper() {
            return new ObjectMapper();
        }
    }
}
