package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Role;

@AutoConfiguration
@SpringLensInternalComponent
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@EnableConfigurationProperties(SpringLensHttpRequestProperties.class)
@ConditionalOnProperty(
        prefix = "spring.lens.http.request",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
@Import({
        HttpRequestInfoCollectorConfiguration.class,
        HttpRequestInfoStorageConfiguration.class,
        HttpRequestInfoHttpExposureConfiguration.class
})
public class SpringLensHttpRequestInfoAutoConfiguration {

}
