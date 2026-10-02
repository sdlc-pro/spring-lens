package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.http.request.HttpRequestCollectorSettings;
import com.sdlcpro.springlens.insight.http.request.HttpRequestInfoCollectorFilter;
import com.sdlcpro.springlens.listener.http.request.HttpRequestInfoCollectListener;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;
import org.springframework.core.Ordered;

import static org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnWebApplication(type = Type.SERVLET)
class HttpRequestInfoCollectorConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public HttpRequestInfoCollectorFilter httpRequestInfoCollectorFilter(
            SpringLensHttpRequestProperties properties,
            ObjectProvider<HttpRequestInfoCollectListener> httpRequestInfoCollectListenerProvider) {

        var settings = new HttpRequestCollectorSettings(
                properties.getInclude().getUriPatterns(),
                properties.getExclude().getUriPatterns(),
                properties.isIncludeRequestBody(),
                properties.isIncludeResponseBody(),
                properties.getMaxBodyLength(),
                properties.getExclude().getMethods(),
                properties.getMaskable().getHeaders(),
                properties.getMaskable().getParams()
        );

        return new HttpRequestInfoCollectorFilter(settings, httpRequestInfoCollectListenerProvider);
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public FilterRegistrationBean<HttpRequestInfoCollectorFilter> httpRequestInfoCollectorFilterRegistration(
            HttpRequestInfoCollectorFilter httpRequestInfoCollectorFilter) {
        var registration = new FilterRegistrationBean<>(httpRequestInfoCollectorFilter);
        registration.setName("httpRequestInfoCollectorFilter");
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
