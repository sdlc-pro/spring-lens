package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.insight.http.request.HttpRequestInfoCollectorFilter;
import com.sdlcpro.springlens.listener.http.request.HttpRequestInfoCollectListener;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class HttpRequestInfoCollectorConfigurationTest {

    private final WebApplicationContextRunner servletRunner = new WebApplicationContextRunner()
            .withUserConfiguration(HttpRequestInfoCollectorConfiguration.class, PropertiesConfiguration.class);

    private final ApplicationContextRunner nonWebRunner = new ApplicationContextRunner()
            .withUserConfiguration(HttpRequestInfoCollectorConfiguration.class, PropertiesConfiguration.class);

    @Test
    void registersFilterAndRegistrationByDefault() {
        servletRunner.run(context -> {
            assertThat(context).hasSingleBean(HttpRequestInfoCollectorConfiguration.class);
            assertThat(context).hasSingleBean(HttpRequestInfoCollectorFilter.class);
            assertThat(context).hasSingleBean(FilterRegistrationBean.class);
        });
    }

    @Test
    void registersFilterThroughAutoConfiguration() {
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensHttpRequestInfoAutoConfiguration.class))
                .run(context -> {
                    assertThat(context).hasSingleBean(HttpRequestInfoCollectorConfiguration.class);
                    assertThat(context).hasSingleBean(HttpRequestInfoCollectorFilter.class);
                });
    }

    @Test
    void backsOffInNonWebApplicationContext() {
        nonWebRunner.run(context -> {
            assertThat(context).doesNotHaveBean(HttpRequestInfoCollectorConfiguration.class);
            assertThat(context).doesNotHaveBean(HttpRequestInfoCollectorFilter.class);
        });
    }

    @Test
    void doesNotRegisterFilterWhenFeatureIsDisabled() {
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensHttpRequestInfoAutoConfiguration.class))
                .withPropertyValues("spring.lens.http.request.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoCollectorConfiguration.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoCollectorFilter.class);
                });
    }

    @Test
    void bindsExcludeAndMaskablePropertiesUsedByFilter() {
        servletRunner
                .withPropertyValues(
                        "spring.lens.http.request.exclude.uri-patterns=/health/**",
                        "spring.lens.http.request.exclude.methods=OPTIONS",
                        "spring.lens.http.request.maskable.headers=Authorization",
                        "spring.lens.http.request.maskable.params=password",
                        "spring.lens.http.request.max-body-length=2048"
                )
                .run(context -> {
                    SpringLensHttpRequestProperties properties = context.getBean(SpringLensHttpRequestProperties.class);
                    assertThat(properties.getExclude().getUriPatterns()).contains("/health/**");
                    assertThat(properties.getMaskable().getHeaders()).containsExactly("Authorization");
                    assertThat(properties.getMaskable().getParams()).containsExactly("password");
                    assertThat(properties.getMaxBodyLength()).isEqualTo(2048);
                    assertThat(context).hasSingleBean(HttpRequestInfoCollectorFilter.class);
                });
    }

    @Test
    void wiresListenerProviderIntoFilter() {
        HttpRequestInfoCollectListener listener = mock(HttpRequestInfoCollectListener.class);

        servletRunner
                .withBean(HttpRequestInfoCollectListener.class, () -> listener)
                .run(context -> {
                    assertThat(context).hasSingleBean(HttpRequestInfoCollectorFilter.class);
                    assertThat(context).hasSingleBean(HttpRequestInfoCollectListener.class);
                });
    }

    @Test
    void collectsWithoutRegisteredListeners() {
        servletRunner.run(context -> {
            assertThat(context).doesNotHaveBean(HttpRequestInfoCollectListener.class);
            assertThat(context.getBean(HttpRequestInfoCollectorFilter.class)).isNotNull();
        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(SpringLensHttpRequestProperties.class)
    static class PropertiesConfiguration {
    }
}
