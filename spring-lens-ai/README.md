# Optional Spring Lens AI

This POC analyzes existing bean-definition facts. It owns its auto-configuration,
limits, worker and HTTP API; it does not collect or instrument application activity.
The standard starter and autoconfigure modules have no dependency on AI.

Add `io.github.sdlc-pro:spring-lens-ai:${spring-lens.version}` alongside the standard
starter. Supply one provider-neutral Spring AI `ChatModel` bean (or a primary bean
when there are multiple models). Choose and configure a provider separately; this
module brings no provider starter, API key configuration, memory or tools.
For a provider starter, import `org.springframework.ai:spring-ai-bom:1.1.8` in the
consuming application's dependency management and select the matching 1.1.8 starter.
Configure provider connect/read timeouts and retry limits as well as the overall
analysis deadline below. Disable provider prompt/completion logging and content
observations; Spring Lens does not log prompts or provider exceptions.

```properties
spring.lens.ai.enabled=true
spring.lens.ai.max-records=100
spring.lens.ai.max-context-chars=2048
spring.lens.ai.max-insight-chars=4000
spring.lens.ai.timeout-millis=10000
```

AI defaults to disabled. Endpoints exist only in a servlet application with AI enabled,
a single candidate `ChatModel`, and an existing `BeanDefinitionInfoRepository`.
No repository or observability collector is created by AI. Missing prerequisites
leave normal Spring Lens functionality intact. Protect `/spring-lens/api/ai/**`
with the application's existing Spring Lens authentication/authorization policy.

`GET /spring-lens/api/ai/capabilities` advertises the supported module and focuses.
`POST /spring-lens/api/ai/insights` accepts only fixed selections:

```json
{"module":"bean-definitions","focus":"OVERVIEW"}
```

Other focuses: `LAZY_INITIALIZATION`, `SCOPES`. Invalid selections return 400;
storage/model failure, timeout, invalid configured limits or saturation return a
fixed 503 without internal details. The UI discovers capabilities over HTTP and
shows an AI insights dialog when available. It renders generated output as text.
It never transmits the DOM, URL parameters or diagnostic payloads to AI.

The privacy projection sends only total/sample counts and counts of lazy, primary,
singleton, prototype and other-scope definitions. Names, types, descriptions,
resources, arbitrary scope names, dependency names, headers, bodies, environment
variables and credentials never enter the prompt. Questions are fixed choices,
not free text. Sampling uses a bounded repository page and a second local record
cap; output explicitly identifies the sample as incomplete. No conversation is kept.

Hard limits: 1–500 records, 256–4096 context characters, 1–8000 output characters,
and 1–30000 ms deadline (including retrieval). Invalid settings fail closed on
analysis. A single daemon worker and zero-length queue bound concurrent AI work.
Cancellation is best effort: a provider ignoring interruption occupies that one
worker until it completes, while subsequent AI requests fail immediately. Provider
transport timeouts are necessary to release resources in that case. These bounds
do not affect standard observability requests. Provider response generation itself
is controlled by the separately configured model; the API truncates returned text.

Compatibility verified on 2026-10-21: Maven Central metadata lists **1.1.8** as the
latest stable 1.1.x release. Coordinates are `org.springframework.ai:spring-ai-bom`
(type `pom`, scope `import`) and `org.springframework.ai:spring-ai-client-chat`;
the latter transitively provides `spring-ai-model` and `ChatModel`.
The BOM is imported only in this module. Boot remains **3.5.16**, Java remains **17**.
Spring's [1.1.8 release announcement](https://spring.io/blog/2026/06/12/spring-ai-1-1-8-1-0-9-avaialble-now/)
aligns that release with Boot 3.5.15, and the
[1.1 getting started guide](https://docs.spring.io/spring-ai/reference/1.1/getting-started.html)
supports Boot 3.4.x/3.5.x. The repository Boot BOM controls Boot dependencies.
No live provider calls are used in tests.
