package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.http.request.HttpRequestInfoRestController;
import com.sdlcpro.springlens.repository.http.HttpRequestInfoRepository;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

import static org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnWebApplication(type = Type.SERVLET)
@ConditionalOnClass({HttpRequestInfoRestController.class})
class HttpRequestInfoHttpExposureConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean(HttpRequestInfoRepository.class)
    public HttpRequestInfoRestController httpRequestInfoRestController(
            HttpRequestInfoRepository httpRequestInfoRepository) {
        return new HttpRequestInfoRestController(httpRequestInfoRepository);
    }
}
