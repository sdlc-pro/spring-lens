package com.sdlcpro.springlens.autoconfigure.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.security.SecurityRestController;
import com.sdlcpro.springlens.repository.security.DependencyInfoRepository;
import com.sdlcpro.springlens.repository.security.SecurityScanRepository;
import com.sdlcpro.springlens.repository.security.VulnerabilityFindingRepository;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass({SecurityRestController.class})
class SecurityScanHttpExposureConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean({SecurityScanRepository.class, DependencyInfoRepository.class, VulnerabilityFindingRepository.class})
    public SecurityRestController securityRestController(
            SecurityScanRepository securityScanRepository,
            DependencyInfoRepository dependencyInfoRepository,
            VulnerabilityFindingRepository vulnerabilityFindingRepository) {
        return new SecurityRestController(
                securityScanRepository, dependencyInfoRepository, vulnerabilityFindingRepository);
    }
}
