package com.sdlcpro.springlens.autoconfigure.bean;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import com.sdlcpro.springlens.storage.bean.definition.InMemoryBeanDefinitionInfoRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/**
 * Configures the default storage for Spring Lens bean metadata.
 *
 * <p>An in-memory repository is registered when the application does not
 * provide a custom {@link BeanDefinitionInfoRepository} implementation.</p>
 */
@SpringLensInternalComponent
public class BeanStorageConfiguration {

    /**
     * Registers the default in-memory repository for bean definition metadata.
     *
     * @return the default bean definition information repository
     */
    @Bean("springLensInMemoryBeanDefinitionInfoRepository")
    @ConditionalOnMissingBean(BeanDefinitionInfoRepository.class)
    public BeanDefinitionInfoRepository beanDefinitionInfoRepository() {
        return new InMemoryBeanDefinitionInfoRepository();
    }
}