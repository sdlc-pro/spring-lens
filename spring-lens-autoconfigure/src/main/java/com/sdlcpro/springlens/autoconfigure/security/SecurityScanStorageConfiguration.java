package com.sdlcpro.springlens.autoconfigure.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.repository.security.DependencyInfoRepository;
import com.sdlcpro.springlens.repository.security.SecurityScanRepository;
import com.sdlcpro.springlens.repository.security.VulnerabilityFindingRepository;
import com.sdlcpro.springlens.storage.security.InMemoryDependencyInfoRepository;
import com.sdlcpro.springlens.storage.security.InMemorySecurityScanRepository;
import com.sdlcpro.springlens.storage.security.InMemoryVulnerabilityFindingRepository;
import com.sdlcpro.springlens.storage.security.SecurityScanPersistenceHandler;
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
@ConditionalOnClass({InMemorySecurityScanRepository.class})
class SecurityScanStorageConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(SecurityScanRepository.class)
    public SecurityScanRepository inMemorySecurityScanRepository() {
        return new InMemorySecurityScanRepository();
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(DependencyInfoRepository.class)
    public DependencyInfoRepository inMemoryDependencyInfoRepository() {
        return new InMemoryDependencyInfoRepository();
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(VulnerabilityFindingRepository.class)
    public VulnerabilityFindingRepository inMemoryVulnerabilityFindingRepository() {
        return new InMemoryVulnerabilityFindingRepository();
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean({SecurityScanRepository.class, DependencyInfoRepository.class, VulnerabilityFindingRepository.class})
    @ConditionalOnMissingBean(SecurityScanPersistenceHandler.class)
    public SecurityScanPersistenceHandler securityScanPersistenceHandler(
            SecurityScanRepository securityScanRepository,
            DependencyInfoRepository dependencyInfoRepository,
            VulnerabilityFindingRepository vulnerabilityFindingRepository) {
        return new SecurityScanPersistenceHandler(
                securityScanRepository, dependencyInfoRepository, vulnerabilityFindingRepository);
    }
}
