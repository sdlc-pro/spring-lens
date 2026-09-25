package com.sdlcpro.springlens.autoconfigure.bean.definition;

import com.sdlcpro.springlens.exposure.bean.BeanDefinitionInfoRestController;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.ReactiveWebApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class BeanDefinitionInfoHttpExposureConfigurationTest {

    private final WebApplicationContextRunner servletRunner = new WebApplicationContextRunner()
            .withUserConfiguration(BeanDefinitionInfoHttpExposureConfiguration.class);

    private final ApplicationContextRunner nonWebRunner = new ApplicationContextRunner()
            .withUserConfiguration(BeanDefinitionInfoHttpExposureConfiguration.class);

    private final ReactiveWebApplicationContextRunner reactiveRunner = new ReactiveWebApplicationContextRunner()
            .withUserConfiguration(BeanDefinitionInfoHttpExposureConfiguration.class);

    @Test
    void registersRestControllerInServletWebApplicationWhenRepositoryIsPresent() {
        BeanDefinitionInfoRepository repository = mock(BeanDefinitionInfoRepository.class);

        servletRunner
                .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).hasSingleBean(BeanDefinitionInfoHttpExposureConfiguration.class);
                    assertThat(context).hasSingleBean(BeanDefinitionInfoRestController.class);
                });
    }

    @Test
    void doesNotRegisterRestControllerWhenRepositoryBeanIsMissing() {
        servletRunner.run(context -> {
            assertThat(context).hasSingleBean(BeanDefinitionInfoHttpExposureConfiguration.class);
            assertThat(context).doesNotHaveBean(BeanDefinitionInfoRestController.class);
        });
    }

    @Test
    void backsOffInNonWebApplicationContext() {
        BeanDefinitionInfoRepository repository = mock(BeanDefinitionInfoRepository.class);

        nonWebRunner
                .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRestController.class);
                });
    }

    @Test
    void backsOffInReactiveWebApplicationContext() {
        BeanDefinitionInfoRepository repository = mock(BeanDefinitionInfoRepository.class);

        reactiveRunner
                .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRestController.class);
                });
    }

    @Test
    void backsOffWhenRestControllerClassIsAbsent() {
        BeanDefinitionInfoRepository repository = mock(BeanDefinitionInfoRepository.class);

        servletRunner
                .withClassLoader(new FilteredClassLoader(BeanDefinitionInfoRestController.class))
                .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRestController.class);
                });
    }

    @Test
    void doesNotRegisterExposureBeansWhenFeatureIsDisabled() {
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensBeanDefinitionInfoAutoConfiguration.class))
                .withPropertyValues("spring.lens.bean.definition.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoHttpExposureConfiguration.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRestController.class);
                });
    }
}
