package com.sdlcpro.springlens.autoconfigure.bean.definition;

import com.sdlcpro.springlens.exposure.bean.BeanDefinitionInfoRestController;
import com.sdlcpro.springlens.insight.bean.definition.BeanDefinitionInfoCollector;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class SpringLensBeanDefinitionInfoAutoConfigurationTest {

    private final WebApplicationContextRunner runner = new WebApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SpringLensBeanDefinitionInfoAutoConfiguration.class));

    @Test
    void registersFeatureBeansByDefault() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(BeanDefinitionInfoRepository.class);
            assertThat(context).hasSingleBean(BeanDefinitionInfoCollector.class);
            assertThat(context).hasSingleBean(BeanDefinitionInfoRestController.class);
        });
    }

    @Test
    void disablesWhenPropertyFalse() {
        runner.withPropertyValues("spring.lens.bean.definition.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRepository.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoCollector.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRestController.class);
                });
    }
}
