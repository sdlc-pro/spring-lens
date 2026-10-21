package com.sdlcpro.springlens.ai;

import com.sdlcpro.springlens.annotation.SpringLensEndpoint;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@SpringLensEndpoint
@SpringLensInternalComponent
@ConditionalOnBean(AiInsightService.class)
@ConditionalOnProperty(prefix = "spring.lens.ai", name = "enabled", havingValue = "true")
@RequestMapping("/spring-lens/api/ai")
public class AiInsightController {
    private final AiInsightService service;
    public AiInsightController(AiInsightService service) { this.service = service; }

    @GetMapping("/capabilities")
    public Capabilities capabilities() { return new Capabilities("bean-definitions", AiInsightService.Focus.values()); }

    /** Only fixed selections are accepted; client page data and free-form questions are never sent to a model. */
    @PostMapping("/insights")
    public ResponseEntity<?> insights(@RequestBody InsightRequest request) {
        if (request == null || !"bean-definitions".equals(request.module()) || request.focus() == null) {
            return ResponseEntity.badRequest().body(new Error("Select a supported module and focus."));
        }
        try {
            return ResponseEntity.ok(new Insight(service.analyze(request.focus()), true));
        } catch (AiInsightService.Unavailable exception) {
            return ResponseEntity.status(503).body(new Error("AI insights are temporarily unavailable."));
        }
    }

    public record InsightRequest(String module, AiInsightService.Focus focus) { }
    public record Insight(String insight, boolean generated) { }
    public record Error(String message) { }
    public record Capabilities(String module, AiInsightService.Focus[] focuses) { }
}
