package com.sdlcpro.springlens.autoconfigure.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.security.ClasspathDependencyInventoryCollector;
import com.sdlcpro.springlens.insight.security.JarDependencyReader;
import com.sdlcpro.springlens.inspector.security.DependencyInventoryCollector;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
class SecurityScanCollectorConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(DependencyInventoryCollector.class)
    public DependencyInventoryCollector dependencyInventoryCollector(ApplicationContext context) {
        return new ClasspathDependencyInventoryCollector(context.getClassLoader(), new JarDependencyReader());
    }
}
