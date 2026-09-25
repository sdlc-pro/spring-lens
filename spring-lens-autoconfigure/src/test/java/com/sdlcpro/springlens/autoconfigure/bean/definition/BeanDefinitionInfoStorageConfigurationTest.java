package com.sdlcpro.springlens.autoconfigure.bean.definition;

import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import com.sdlcpro.springlens.storage.bean.definition.BeanDefinitionInfoPersistenceHandler;
import com.sdlcpro.springlens.storage.bean.definition.InMemoryBeanDefinitionInfoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class BeanDefinitionInfoStorageConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(BeanDefinitionInfoStorageConfiguration.class);

    @Test
    void registersStorageBeansWhenInMemoryRepositoryClassIsPresent() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(BeanDefinitionInfoStorageConfiguration.class);
            assertThat(context).hasSingleBean(BeanDefinitionInfoRepository.class);
            assertThat(context).hasSingleBean(InMemoryBeanDefinitionInfoRepository.class);
            assertThat(context).hasSingleBean(BeanDefinitionInfoPersistenceHandler.class);
            assertThat(context.getBean(BeanDefinitionInfoRepository.class))
                    .isInstanceOf(InMemoryBeanDefinitionInfoRepository.class);
        });
    }

    @Test
    void backsOffWhenInMemoryRepositoryClassIsAbsent() {
        contextRunner
                .withClassLoader(new FilteredClassLoader(InMemoryBeanDefinitionInfoRepository.class))
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoStorageConfiguration.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRepository.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoPersistenceHandler.class);
                });
    }

    @Test
    void backsOffDefaultRepositoryWhenCustomRepositoryIsDefined() {
        BeanDefinitionInfoRepository customRepository = mock(BeanDefinitionInfoRepository.class);

        contextRunner
                .withBean(BeanDefinitionInfoRepository.class, () -> customRepository)
                .run(context -> {
                    assertThat(context).hasSingleBean(BeanDefinitionInfoRepository.class);
                    assertThat(context).doesNotHaveBean(InMemoryBeanDefinitionInfoRepository.class);
                    assertThat(context.getBean(BeanDefinitionInfoRepository.class)).isSameAs(customRepository);
                    assertThat(context).hasSingleBean(BeanDefinitionInfoPersistenceHandler.class);
                });
    }

    @Test
    void backsOffDefaultPersistenceHandlerWhenCustomHandlerIsDefined() {
        BeanDefinitionInfoRepository repository = new InMemoryBeanDefinitionInfoRepository();
        BeanDefinitionInfoPersistenceHandler customHandler =
                new BeanDefinitionInfoPersistenceHandler(repository);

        contextRunner
                .withBean(BeanDefinitionInfoPersistenceHandler.class, () -> customHandler)
                .run(context -> {
                    assertThat(context).hasSingleBean(BeanDefinitionInfoRepository.class);
                    assertThat(context).hasSingleBean(BeanDefinitionInfoPersistenceHandler.class);
                    assertThat(context.getBean(BeanDefinitionInfoPersistenceHandler.class))
                            .isSameAs(customHandler);
                });
    }

    @Test
    void doesNotRegisterStorageBeansWhenFeatureIsDisabled() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensBeanDefinitionInfoAutoConfiguration.class))
                .withPropertyValues("spring.lens.bean.definition.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoStorageConfiguration.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoRepository.class);
                    assertThat(context).doesNotHaveBean(BeanDefinitionInfoPersistenceHandler.class);
                });
    }
}
