package com.sdlcpro.springlens.autoconfigure.bean.definition;

import com.sdlcpro.springlens.autoconfigure.bean.SpringLensBeanProperties;
import com.sdlcpro.springlens.insight.bean.definition.BeanDefinitionInfoCollector;
import com.sdlcpro.springlens.listener.bean.BeanDefinitionInfoCollectListener;
import com.sdlcpro.springlens.model.bean.definition.BeanDefinitionInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class BeanDefinitionInfoCollectorConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(BeanDefinitionInfoCollectorConfiguration.class, PropertiesConfiguration.class);

    @Test
    void registersCollectorByDefault() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(BeanDefinitionInfoCollectorConfiguration.class);
            assertThat(context).hasSingleBean(BeanDefinitionInfoCollector.class);
            assertThat(context).hasSingleBean(SpringLensBeanProperties.class);
        });
    }

    @Test
    void registersCollectorThroughAutoConfiguration() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensBeanDefinitionInfoAutoConfiguration.class))
                .run(context -> {
                    assertThat(context).hasSingleBean(BeanDefinitionInfoCollectorConfiguration.class);
                    assertThat(context).hasSingleBean(BeanDefinitionInfoCollector.class);
                });
    }

    @Test
    void registersCollectorAsInfrastructureBean() {
        contextRunner.run(context -> {
            BeanDefinition definition = context.getBeanFactory()
                    .getBeanDefinition("beanDefinitionInfoCollector");
            assertThat(definition.getRole()).isEqualTo(BeanDefinition.ROLE_INFRASTRUCTURE);
        });
    }

    @Test
    void doesNotRegisterCollectorWhenFeatureIsDisabled() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensBeanDefinitionInfoAutoConfiguration.class))
                .withPropertyValues("spring.lens.bean.definition.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoCollectorConfiguration.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoCollector.class);
                });
    }

    @Test
    void bindsIncludeAndExcludePropertiesUsedByCollector() {
        contextRunner
                .withPropertyValues(
                        "spring.lens.bean.include.role-infra=true",
                        "spring.lens.bean.include.tool-internal=true",
                        "spring.lens.bean.exclude.package-patterns=com.example.**",
                        "spring.lens.bean.exclude.classes=com.example.Foo"
                )
                .run(context -> {
                    SpringLensBeanProperties properties = context.getBean(SpringLensBeanProperties.class);
                    assertThat(properties.getInclude().isRoleInfra()).isTrue();
                    assertThat(properties.getInclude().isToolInternal()).isTrue();
                    assertThat(properties.getExclude().getPackagePatterns()).containsExactly("com.example.**");
                    assertThat(properties.getExclude().getClasses()).containsExactly("com.example.Foo");
                    assertThat(context).hasSingleBean(BeanDefinitionInfoCollector.class);
                });
    }

    @Test
    void wiresListenerProviderIntoCollector() {
        BeanDefinitionInfoCollectListener listener = mock(BeanDefinitionInfoCollectListener.class);

        contextRunner
                .withBean(BeanDefinitionInfoCollectListener.class, () -> listener)
                .run(context -> {
                    assertThat(context).hasSingleBean(BeanDefinitionInfoCollector.class);
                    assertThat(context).hasSingleBean(BeanDefinitionInfoCollectListener.class);

                    context.getBean(BeanDefinitionInfoCollector.class).afterSingletonsInstantiated();

                    verify(listener, atLeastOnce()).onBeanDefinitionInfoCollect(any(BeanDefinitionInfo.class));
                });
    }

    @Test
    void collectsWithoutRegisteredListeners() {
        contextRunner.run(context -> {
            assertThat(context).doesNotHaveBean(BeanDefinitionInfoCollectListener.class);

            BeanDefinitionInfoCollector collector = context.getBean(BeanDefinitionInfoCollector.class);
            collector.afterSingletonsInstantiated();

            assertThat(collector).isNotNull();
        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(SpringLensBeanProperties.class)
    static class PropertiesConfiguration {
    }
}
