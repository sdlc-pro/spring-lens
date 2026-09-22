package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.exposure.http.request.HttpRequestInfoRestController;
import com.sdlcpro.springlens.insight.http.request.HttpRequestInfoCollectorFilter;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class SpringLensHttpRequestInfoAutoConfigurationTest {

    private final WebApplicationContextRunner runner = new WebApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SpringLensHttpRequestInfoAutoConfiguration.class));

    @Test
    void registersFeatureBeansByDefault() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(HttpRequestInfoRepository.class);
            assertThat(context).hasSingleBean(HttpRequestInfoCollectorFilter.class);
            assertThat(context).hasSingleBean(HttpRequestInfoRestController.class);
        });
    }

    @Test
    void disablesWhenPropertyFalse() {
        runner.withPropertyValues("spring.lens.http.request.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRepository.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoCollectorFilter.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRestController.class);
                });
    }
}
