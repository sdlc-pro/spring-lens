package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.exposure.http.request.HttpRequestInfoRestController;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.ReactiveWebApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class HttpRequestInfoHttpExposureConfigurationTest {

    private final WebApplicationContextRunner servletRunner = new WebApplicationContextRunner()
            .withUserConfiguration(HttpRequestInfoHttpExposureConfiguration.class);

    private final ApplicationContextRunner nonWebRunner = new ApplicationContextRunner()
            .withUserConfiguration(HttpRequestInfoHttpExposureConfiguration.class);

    private final ReactiveWebApplicationContextRunner reactiveRunner = new ReactiveWebApplicationContextRunner()
            .withUserConfiguration(HttpRequestInfoHttpExposureConfiguration.class);

    @Test
    void registersRestControllerInServletWebApplicationWhenRepositoryIsPresent() {
        HttpRequestInfoRepository repository = mock(HttpRequestInfoRepository.class);

        servletRunner
                .withBean(HttpRequestInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).hasSingleBean(HttpRequestInfoHttpExposureConfiguration.class);
                    assertThat(context).hasSingleBean(HttpRequestInfoRestController.class);
                });
    }

    @Test
    void doesNotRegisterRestControllerWhenRepositoryBeanIsMissing() {
        servletRunner.run(context -> {
            assertThat(context).hasSingleBean(HttpRequestInfoHttpExposureConfiguration.class);
            assertThat(context).doesNotHaveBean(HttpRequestInfoRestController.class);
        });
    }

    @Test
    void backsOffInNonWebApplicationContext() {
        HttpRequestInfoRepository repository = mock(HttpRequestInfoRepository.class);

        nonWebRunner
                .withBean(HttpRequestInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRestController.class);
                });
    }

    @Test
    void backsOffInReactiveWebApplicationContext() {
        HttpRequestInfoRepository repository = mock(HttpRequestInfoRepository.class);

        reactiveRunner
                .withBean(HttpRequestInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRestController.class);
                });
    }

    @Test
    void backsOffWhenRestControllerClassIsAbsent() {
        HttpRequestInfoRepository repository = mock(HttpRequestInfoRepository.class);

        servletRunner
                .withClassLoader(new FilteredClassLoader(HttpRequestInfoRestController.class))
                .withBean(HttpRequestInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRestController.class);
                });
    }

    @Test
    void doesNotRegisterExposureBeansWhenFeatureIsDisabled() {
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensHttpRequestInfoAutoConfiguration.class))
                .withPropertyValues("spring.lens.http.request.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRestController.class);
                });
    }
}
