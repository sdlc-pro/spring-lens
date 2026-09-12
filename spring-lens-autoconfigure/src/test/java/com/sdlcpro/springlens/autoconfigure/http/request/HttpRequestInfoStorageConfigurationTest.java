package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import com.sdlcpro.springlens.storage.http.request.HttpRequestInfoPersistenceHandler;
import com.sdlcpro.springlens.storage.http.request.InMemoryHttpRequestInfoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class HttpRequestInfoStorageConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(HttpRequestInfoStorageConfiguration.class);

    @Test
    void registersStorageBeansWhenInMemoryRepositoryClassIsPresent() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(HttpRequestInfoStorageConfiguration.class);
            assertThat(context).hasSingleBean(HttpRequestInfoRepository.class);
            assertThat(context).hasSingleBean(InMemoryHttpRequestInfoRepository.class);
            assertThat(context).hasSingleBean(HttpRequestInfoPersistenceHandler.class);
            assertThat(context.getBean(HttpRequestInfoRepository.class))
                    .isInstanceOf(InMemoryHttpRequestInfoRepository.class);
        });
    }

    @Test
    void backsOffWhenInMemoryRepositoryClassIsAbsent() {
        contextRunner
                .withClassLoader(new FilteredClassLoader(InMemoryHttpRequestInfoRepository.class))
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoStorageConfiguration.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRepository.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoPersistenceHandler.class);
                });
    }

    @Test
    void backsOffDefaultRepositoryWhenCustomRepositoryIsDefined() {
        HttpRequestInfoRepository customRepository = mock(HttpRequestInfoRepository.class);

        contextRunner
                .withBean(HttpRequestInfoRepository.class, () -> customRepository)
                .run(context -> {
                    assertThat(context).hasSingleBean(HttpRequestInfoRepository.class);
                    assertThat(context).doesNotHaveBean(InMemoryHttpRequestInfoRepository.class);
                    assertThat(context.getBean(HttpRequestInfoRepository.class)).isSameAs(customRepository);
                    assertThat(context).hasSingleBean(HttpRequestInfoPersistenceHandler.class);
                });
    }

    @Test
    void backsOffDefaultPersistenceHandlerWhenCustomHandlerIsDefined() {
        HttpRequestInfoRepository repository = new InMemoryHttpRequestInfoRepository();
        HttpRequestInfoPersistenceHandler customHandler = new HttpRequestInfoPersistenceHandler(repository);

        contextRunner
                .withBean(HttpRequestInfoPersistenceHandler.class, () -> customHandler)
                .run(context -> {
                    assertThat(context).hasSingleBean(HttpRequestInfoRepository.class);
                    assertThat(context).hasSingleBean(HttpRequestInfoPersistenceHandler.class);
                    assertThat(context.getBean(HttpRequestInfoPersistenceHandler.class)).isSameAs(customHandler);
                });
    }

    @Test
    void doesNotRegisterStorageBeansWhenFeatureIsDisabled() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SpringLensHttpRequestInfoAutoConfiguration.class))
                .withPropertyValues("spring.lens.http.request.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(HttpRequestInfoStorageConfiguration.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoRepository.class);
                    assertThat(context).doesNotHaveBean(HttpRequestInfoPersistenceHandler.class);
                });
    }
}
