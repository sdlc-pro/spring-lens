package com.sdlcpro.springlens.ai;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureOrder;
import org.springframework.core.Ordered;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration(afterName = {
        "com.sdlcpro.springlens.autoconfigure.bean.definition.SpringLensBeanDefinitionInfoAutoConfiguration",
        "org.springframework.ai.model.chat.client.autoconfigure.ChatClientAutoConfiguration"
})
@AutoConfigureOrder(Ordered.LOWEST_PRECEDENCE)
@SpringLensInternalComponent
@ConditionalOnClass({ChatModel.class, ChatClient.class})
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnProperty(prefix = "spring.lens.ai", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(AiProperties.class)
public class SpringLensAiAutoConfiguration {
    @Bean(destroyMethod = "close")
    @ConditionalOnSingleCandidate(ChatModel.class)
    @ConditionalOnBean(BeanDefinitionInfoRepository.class)
    @ConditionalOnMissingBean
    AiInsightService aiInsightService(BeanDefinitionInfoRepository repository, ChatModel model, AiProperties properties) {
        return new AiInsightService(new BeanFacts(repository), ChatClient.create(model), properties);
    }

    @Bean
    @ConditionalOnBean(AiInsightService.class)
    @ConditionalOnMissingBean
    AiInsightController aiInsightController(AiInsightService service) { return new AiInsightController(service); }
}
