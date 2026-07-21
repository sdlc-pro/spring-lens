package com.sdlcpro.springlens.autoconfigure.bean;

import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import com.sdlcpro.springlens.storage.bean.definition.InMemoryBeanDefinitionInfoRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;


class BeanStorageConfigurationTest {

    private static final String REPOSITORY_BEAN_NAME =
            "springLensInMemoryBeanDefinitionInfoRepository";

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner()
                    .withUserConfiguration(BeanStorageConfiguration.class);

    @Test
    void registersDefaultRepositoryWhenNoCustomRepositoryExists() {
        contextRunner.run(context -> {
            assertThat(context).hasBean(REPOSITORY_BEAN_NAME);
            assertThat(context).hasSingleBean(BeanDefinitionInfoRepository.class);
            assertThat(context.getBean(BeanDefinitionInfoRepository.class))
                    .isInstanceOf(InMemoryBeanDefinitionInfoRepository.class);
        });
    }

    @Test
    void backsOffWhenCustomRepositoryExists() {
        BeanDefinitionInfoRepository customRepository =
                mock(BeanDefinitionInfoRepository.class);

        contextRunner
                .withBean(
                        "customBeanDefinitionInfoRepository",
                        BeanDefinitionInfoRepository.class,
                        () -> customRepository
                )
                .run(context -> {
                    assertThat(context).doesNotHaveBean(REPOSITORY_BEAN_NAME);
                    assertThat(context).hasSingleBean(BeanDefinitionInfoRepository.class);
                    assertThat(context.getBean(BeanDefinitionInfoRepository.class))
                            .isSameAs(customRepository);
                });
    }    
}

