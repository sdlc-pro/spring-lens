package com.sdlcpro.springlens.ai;

import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.model.bean.definition.BeanDefinitionInfo;
import com.sdlcpro.springlens.query.*;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.*;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AiTests {
    private final BeanDefinitionInfoRepository repository = mock(BeanDefinitionInfoRepository.class);
    private final ChatModel model = mock(ChatModel.class);
    private final WebApplicationContextRunner runner = new WebApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SpringLensAiAutoConfiguration.class));

    @Test void disabledByDefaultAndExplicitlyDisabled() {
        for (String value : List.of("false", "")) {
            runner.withBean(ChatModel.class, () -> model)
                    .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                    .withPropertyValues("spring.lens.ai.enabled=" + value)
                    .run(context -> assertThat(context).doesNotHaveBean(AiInsightController.class).doesNotHaveBean(AiInsightService.class));
        }
        runner.withBean(ChatModel.class, () -> model).run(context -> assertThat(context).doesNotHaveBean(AiInsightService.class));
        verifyNoInteractions(repository);
        verify(model, never()).call(any(Prompt.class));
    }

    @Test void enabledRequiresModelAndExistingStorage() {
        runner.withPropertyValues("spring.lens.ai.enabled=true")
                .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .run(context -> assertThat(context).doesNotHaveBean(AiInsightController.class));
        runner.withPropertyValues("spring.lens.ai.enabled=true").withBean(ChatModel.class, () -> model)
                .run(context -> assertThat(context).doesNotHaveBean(AiInsightController.class));
        runner.withPropertyValues("spring.lens.ai.enabled=true")
                .withBean(ChatModel.class, () -> model).withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .run(context -> assertThat(context).hasSingleBean(AiInsightService.class).hasSingleBean(AiInsightController.class));
        verifyNoInteractions(repository);
        verify(model, never()).call(any(Prompt.class));
    }

    @Test void missingAiClassesAndAmbiguousModelsLeaveEndpointsAbsent() {
        runner.withClassLoader(new org.springframework.boot.test.context.FilteredClassLoader(ChatModel.class))
                .withPropertyValues("spring.lens.ai.enabled=true")
                .run(context -> assertThat(context).doesNotHaveBean(AiInsightController.class));
        runner.withPropertyValues("spring.lens.ai.enabled=true")
                .withBean("first", ChatModel.class, () -> model)
                .withBean("second", ChatModel.class, () -> mock(ChatModel.class))
                .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .run(context -> assertThat(context).doesNotHaveBean(AiInsightService.class));
    }

    @Test void successUsesExistingInMemoryStorage() throws Exception {
        var storage = new com.sdlcpro.springlens.storage.bean.definition.InMemoryBeanDefinitionInfoRepository();
        storage.save(new BeanDefinitionInfo("context", "bean", List.of(), "type", null, null,
                "singleton", false, false, true, BeanRole.ROLE_APPLICATION,
                null, null, null, null, List.of(), List.of()));
        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage("One sampled singleton.")))));
        try (var service = new AiInsightService(new BeanFacts(storage), ChatClient.create(model), new AiProperties())) {
            var mvc = MockMvcBuilders.standaloneSetup(new AiInsightController(service)).build();
            mvc.perform(post("/spring-lens/api/ai/insights").contentType("application/json")
                    .content("{\"module\":\"bean-definitions\",\"focus\":\"OVERVIEW\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.insight").value("One sampled singleton."))
                    .andExpect(jsonPath("$.generated").value(true));
            assertThat(storage.count()).isEqualTo(1);
        }
    }

    @org.springframework.boot.autoconfigure.AutoConfiguration
    static class ProviderConfiguration {
        @org.springframework.context.annotation.Bean ChatModel providerModel() { return mock(ChatModel.class); }
    }

    @Test void modelFromProviderAutoConfigurationIsDetected() {
        runner.withConfiguration(AutoConfigurations.of(ProviderConfiguration.class))
                .withBean(BeanDefinitionInfoRepository.class, () -> repository)
                .withPropertyValues("spring.lens.ai.enabled=true")
                .run(context -> assertThat(context).hasSingleBean(AiInsightController.class));
    }

    private void storedData() {
        var bean = new BeanDefinitionInfo("credential-context", "secret-name", List.of("secret-alias"),
                "secret-type", "secret-resource", "Authorization: Bearer secret", "secret-scope", true, true,
                true, BeanRole.ROLE_APPLICATION, "secret-init", "secret-destroy", "secret-factory", "secret-method",
                List.of("secret-dependency"), List.of("secret-dependent"));
        when(repository.findAll(any(PageRequest.class))).thenAnswer(call ->
                new PageResponse<>(List.of(bean, bean, bean), call.getArgument(0), 3));
    }

    private AiInsightService service(AiProperties properties) {
        return new AiInsightService(new BeanFacts(repository), ChatClient.create(model), properties);
    }

    @Test void boundedProjectionNeverIncludesArbitraryFields() {
        storedData();
        var properties = new AiProperties();
        properties.setMaxRecords(2);
        properties.setMaxContextChars(256);
        String context = new BeanFacts(repository).context(properties);
        assertThat(context).contains("sampled=2", "lazy=2", "otherScope=2").doesNotContain("secret", "credential", "Authorization");
        assertThat(context.length()).isLessThanOrEqualTo(256);
        verify(repository).findAll(new PageRequest(0, 2, Sort.unsorted()));
        verifyNoMoreInteractions(repository);
    }

    @Test void modelReceivesOnlySanitizedCountsAndOutputIsLimited() {
        storedData();
        var prompt = new AtomicReference<Prompt>();
        when(model.call(any(Prompt.class))).thenAnswer(call -> {
            prompt.set(call.getArgument(0));
            return new ChatResponse(List.of(new Generation(new AssistantMessage("safe\u0000 output too long"))));
        });
        var properties = new AiProperties();
        properties.setMaxInsightChars(8);
        try (var service = service(properties)) {
            assertThat(service.analyze(AiInsightService.Focus.SCOPES)).isEqualTo("safe out");
        }
        assertThat(prompt.get().getContents()).contains("SCOPES", "sampled=3").doesNotContain("secret", "credential", "Authorization");
    }

    @Test void validationAndErrorsStayWithinAiEndpoint() throws Exception {
        storedData();
        when(model.call(any(Prompt.class))).thenThrow(new IllegalStateException("private provider credential"));
        try (var service = service(new AiProperties())) {
            MockMvc mvc = MockMvcBuilders.standaloneSetup(new AiInsightController(service)).build();
            mvc.perform(get("/spring-lens/api/ai/capabilities")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.module").value("bean-definitions"));
            for (String body : List.of("{}", "{\"module\":\"http\",\"focus\":\"OVERVIEW\"}",
                    "{\"module\":\"bean-definitions\",\"focus\":\"arbitrary\"}", "not json")) {
                mvc.perform(post("/spring-lens/api/ai/insights").contentType("application/json").content(body))
                        .andExpect(status().isBadRequest());
            }
            verifyNoInteractions(repository);
        verify(model, never()).call(any(Prompt.class));
            mvc.perform(post("/spring-lens/api/ai/insights").contentType("application/json")
                            .content("{\"module\":\"bean-definitions\",\"focus\":\"OVERVIEW\"}"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.message").value("AI insights are temporarily unavailable."));
        }
    }

    @Test void invalidLimitsAndRepositoryFailureDoNotCallProvider() {
        var limits = new AiProperties();
        limits.setMaxRecords(501);
        try (var service = service(limits)) {
            assertThatThrownBy(() -> service.analyze(AiInsightService.Focus.OVERVIEW)).isInstanceOf(AiInsightService.Unavailable.class);
        }
        verifyNoInteractions(repository);
        verify(model, never()).call(any(Prompt.class));
        when(repository.findAll(any(PageRequest.class))).thenThrow(new IllegalStateException("secret storage details"));
        try (var service = service(new AiProperties())) {
            assertThatThrownBy(() -> service.analyze(AiInsightService.Focus.OVERVIEW)).isInstanceOf(AiInsightService.Unavailable.class)
                    .hasMessage(null).hasNoCause();
        }
        verify(model, never()).call(any(Prompt.class));
    }

    @Test void timeoutAndBusyWorkerAreBoundedEvenIfProviderIgnoresInterruption() throws Exception {
        storedData();
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(model.call(any(Prompt.class))).thenAnswer(call -> {
            entered.countDown();
            while (release.getCount() > 0) {
                try { release.await(); } catch (InterruptedException ignored) { /* emulate an uncooperative provider */ }
            }
            return new ChatResponse(List.of(new Generation(new AssistantMessage("late"))));
        });
        var limits = new AiProperties();
        limits.setTimeoutMillis(100);
        try (var service = service(limits)) {
            assertThatThrownBy(() -> service.analyze(AiInsightService.Focus.OVERVIEW)).isInstanceOf(AiInsightService.Unavailable.class);
            assertThat(entered.await(1, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> service.analyze(AiInsightService.Focus.OVERVIEW)).isInstanceOf(AiInsightService.Unavailable.class);
            verify(model, times(1)).call(any(Prompt.class));
        } finally { release.countDown(); }
    }
}
