package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import com.sdlcpro.springlens.storage.http.request.HttpRequestInfoPersistenceHandler;
import com.sdlcpro.springlens.storage.http.request.InMemoryHttpRequestInfoRepository;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnClass({InMemoryHttpRequestInfoRepository.class})
class HttpRequestInfoStorageConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(HttpRequestInfoRepository.class)
    public HttpRequestInfoRepository inMemoryHttpRequestInfoRepository() {
        return new InMemoryHttpRequestInfoRepository();
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean(HttpRequestInfoRepository.class)
    @ConditionalOnMissingBean(HttpRequestInfoPersistenceHandler.class)
    public HttpRequestInfoPersistenceHandler httpRequestInfoPersistenceHandler(
            HttpRequestInfoRepository httpRequestInfoRepository) {
        return new HttpRequestInfoPersistenceHandler(httpRequestInfoRepository);
    }
}
