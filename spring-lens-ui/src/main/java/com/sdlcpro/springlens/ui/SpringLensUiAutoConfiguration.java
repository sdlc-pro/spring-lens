package com.sdlcpro.springlens.ui;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@AutoConfiguration
@SpringLensInternalComponent
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class SpringLensUiAutoConfiguration implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/spring-lens/ui/**")
                .addResourceLocations("classpath:/META-INF/spring-lens/ui/")
                .setCachePeriod(0);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        String redirectTo = "/spring-lens/ui/";
        registry.addRedirectViewController("/spring-lens", redirectTo);
        registry.addRedirectViewController("/spring-lens/ui", redirectTo);
        registry.addViewController("/spring-lens/ui/").setViewName("forward:/spring-lens/ui/index.html");
    }
}
