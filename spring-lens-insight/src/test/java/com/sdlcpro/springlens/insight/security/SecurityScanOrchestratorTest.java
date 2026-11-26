package com.sdlcpro.springlens.insight.security;

import com.sdlcpro.springlens.exception.VulnerabilityDataUnavailableException;
import com.sdlcpro.springlens.inspector.security.DependencyInventoryCollector;
import com.sdlcpro.springlens.inspector.security.VulnerabilityDataProvider;
import com.sdlcpro.springlens.listener.security.SecurityScanListener;
import com.sdlcpro.springlens.model.security.DependencyEcosystem;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.SecurityScanResult;
import com.sdlcpro.springlens.model.security.VulnerabilityFinding;
import com.sdlcpro.springlens.model.security.VulnerabilitySeverity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ConfigurableApplicationContext;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.EVALUATED;
import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.NOT_EVALUATED;
import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.UNRESOLVED;
import static com.sdlcpro.springlens.model.security.SecurityScanStatus.COMPLETED;
import static com.sdlcpro.springlens.model.security.SecurityScanStatus.FAILED;
import static com.sdlcpro.springlens.model.security.SecurityScanStatus.RUNNING;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SecurityScanOrchestratorTest {

    private final DependencyInventoryCollector collector = mock(DependencyInventoryCollector.class);
    private final VulnerabilityDataProvider provider = mock(VulnerabilityDataProvider.class);
    private final RecordingListener listener = new RecordingListener();
    private SecurityScanOrchestrator orchestrator;

    private final DependencyInfo snakeyaml133 = new DependencyInfo("org.yaml", "snakeyaml", "1.33",
            DependencyEcosystem.MAVEN, "snakeyaml-1.33.jar", null);
    private final DependencyInfo toolsUnresolved = new DependencyInfo(null, "tools", null,
            DependencyEcosystem.MAVEN, "tools.jar", UNRESOLVED);
    private final VulnerabilityFinding finding = new VulnerabilityFinding("GHSA-1", List.of(),
            new DependencyKey("org.yaml", "snakeyaml", "1.33"), "s", VulnerabilitySeverity.HIGH,
            null, null, null, null, null, null, null);

    @BeforeEach
    void setUp() {
        when(provider.name()).thenReturn("osv.dev");
        orchestrator = newOrchestrator(true);
    }

    @AfterEach
    void tearDown() {
        orchestrator.destroy();
    }

    private SecurityScanOrchestrator newOrchestrator(boolean scanOnStartup) {
        SecurityScanSettings settings = new SecurityScanSettings(scanOnStartup,
                URI.create("https://api.osv.dev"), Duration.ofSeconds(10), 500);
        return new SecurityScanOrchestrator(collector, provider, settings, listeners());
    }

    @SuppressWarnings("unchecked")
    private ObjectProvider<SecurityScanListener> listeners() {
        ObjectProvider<SecurityScanListener> objectProvider = mock(ObjectProvider.class);
        when(objectProvider.stream()).thenAnswer(inv -> java.util.stream.Stream.of(listener));
        return objectProvider;
    }

    private static ApplicationReadyEvent readyEvent() {
        return new ApplicationReadyEvent(mock(SpringApplication.class), new String[0],
                mock(ConfigurableApplicationContext.class), Duration.ZERO);
    }

    @Test
    void scanPublishesRunningThenCompletedWithEvaluatedDependencies() {
        when(collector.collect()).thenReturn(List.of(snakeyaml133, toolsUnresolved));
        when(provider.findVulnerabilities(List.of(snakeyaml133))).thenReturn(List.of(finding));

        SecurityScanResult result = orchestrator.scan();

        assertThat(listener.started).hasSize(1);
        assertThat(listener.started.get(0).status()).isEqualTo(RUNNING);
        assertThat(result.scan().status()).isEqualTo(COMPLETED);
        assertThat(result.scan().dataSource()).isEqualTo(provider.name());
        assertThat(result.scan().id()).isEqualTo(listener.started.get(0).id());
        assertThat(result.dependencies()).extracting(DependencyInfo::evaluationStatus)
                .containsExactly(EVALUATED, UNRESOLVED);
        assertThat(result.findings()).containsExactly(finding);
        assertThat(result.scan().inventoryDuration()).isNotNull();
        assertThat(result.scan().evaluationDuration()).isNotNull();
        assertThat(listener.completed).containsExactly(result);
    }

    @Test
    void providerFailureProducesFailedScanAndKeepsDependenciesNotEvaluated() {
        when(collector.collect()).thenReturn(List.of(snakeyaml133, toolsUnresolved));
        when(provider.findVulnerabilities(any()))
                .thenThrow(new VulnerabilityDataUnavailableException("OSV responded with HTTP 503"));

        SecurityScanResult result = orchestrator.scan();

        assertThat(result.scan().status()).isEqualTo(FAILED);
        assertThat(result.scan().errorMessage()).isEqualTo("OSV responded with HTTP 503");
        assertThat(result.dependencies()).extracting(DependencyInfo::evaluationStatus)
                .containsExactly(NOT_EVALUATED, UNRESOLVED);
        assertThat(result.findings()).isEmpty();
        assertThat(listener.completed).containsExactly(result);
    }

    @Test
    void unexpectedProviderRuntimeExceptionProducesFailedScan() {
        when(collector.collect()).thenReturn(List.of(snakeyaml133));
        when(provider.findVulnerabilities(any())).thenThrow(new IllegalStateException("bad"));

        SecurityScanResult result = orchestrator.scan();

        assertThat(result.scan().status()).isEqualTo(FAILED);
        assertThat(result.scan().errorMessage()).isEqualTo("bad");
    }

    @Test
    void collectorFailureProducesFailedScanWithEmptyInventory() {
        when(collector.collect()).thenThrow(new RuntimeException("boom"));

        SecurityScanResult result = orchestrator.scan();

        assertThat(result.scan().status()).isEqualTo(FAILED);
        assertThat(result.scan().dependencyCount()).isZero();
        assertThat(result.scan().errorMessage()).contains("boom");
        assertThat(result.dependencies()).isEmpty();
    }

    @Test
    void collectorFailureWithoutMessageUsesExceptionClassName() {
        when(collector.collect()).thenThrow(new IllegalStateException());

        SecurityScanResult result = orchestrator.scan();

        assertThat(result.scan().errorMessage()).isEqualTo("java.lang.IllegalStateException");
    }

    @Test
    void noResolvedDependenciesSkipsProviderAndCompletes() {
        when(collector.collect()).thenReturn(List.of(toolsUnresolved));

        SecurityScanResult result = orchestrator.scan();

        verify(provider, never()).findVulnerabilities(any());
        assertThat(result.scan().status()).isEqualTo(COMPLETED);
        assertThat(result.findings()).isEmpty();
        assertThat(result.dependencies()).extracting(DependencyInfo::evaluationStatus).containsExactly(UNRESOLVED);
    }

    @Test
    void onApplicationReadyRunsScanAsynchronouslyWhenEnabled() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> threadName = new AtomicReference<>();
        when(collector.collect()).thenAnswer(inv -> {
            threadName.set(Thread.currentThread().getName());
            latch.countDown();
            return new ArrayList<DependencyInfo>();
        });

        orchestrator.onApplicationEvent(readyEvent());

        assertThat(latch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(Thread.currentThread().getName()).isNotEqualTo(threadName.get());
        assertThat(threadName.get()).isEqualTo("spring-lens-security-scan");
    }

    @Test
    void onApplicationReadyDoesNothingWhenScanOnStartupFalse() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        when(collector.collect()).thenAnswer(inv -> {
            latch.countDown();
            return List.of();
        });
        SecurityScanOrchestrator disabled = newOrchestrator(false);
        try {
            disabled.onApplicationEvent(readyEvent());
            assertThat(latch.await(300, TimeUnit.MILLISECONDS)).isFalse();
        } finally {
            disabled.destroy();
        }
    }

    @Test
    void destroyShutsDownExecutor() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        when(collector.collect()).thenAnswer(inv -> {
            latch.countDown();
            return List.of();
        });
        orchestrator.destroy();

        orchestrator.onApplicationEvent(readyEvent());

        assertThat(latch.await(300, TimeUnit.MILLISECONDS)).isFalse();
    }

    @Test
    void errorOnScanThreadIsHandledAndExecutorSurvives() throws Exception {
        CountDownLatch first = new CountDownLatch(1);
        CountDownLatch second = new CountDownLatch(1);
        when(collector.collect()).thenAnswer(inv -> {
            if (first.getCount() > 0) {
                first.countDown();
                throw new NoClassDefFoundError("x");
            }
            second.countDown();
            return List.of();
        });

        orchestrator.onApplicationEvent(readyEvent());
        assertThat(first.await(5, TimeUnit.SECONDS)).isTrue();
        orchestrator.onApplicationEvent(readyEvent());

        assertThat(second.await(5, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    @SuppressWarnings("unchecked")
    void listenerResolutionFailureOnStartedPublishDoesNotLoseResult() {
        when(collector.collect()).thenReturn(List.of(snakeyaml133));
        when(provider.findVulnerabilities(any())).thenReturn(List.of(finding));
        ObjectProvider<SecurityScanListener> broken = mock(ObjectProvider.class);
        when(broken.stream()).thenThrow(new IllegalStateException("cannot create listener"));
        SecurityScanOrchestrator o = new SecurityScanOrchestrator(collector, provider,
                new SecurityScanSettings(true, URI.create("https://api.osv.dev"), Duration.ofSeconds(10), 500), broken);
        try {
            SecurityScanResult result = o.scan();
            assertThat(result.scan().status()).isEqualTo(COMPLETED);
        } finally {
            o.destroy();
        }
    }

    @Test
    void listenerThrowingOnCompletedStillReturnsResult() {
        when(collector.collect()).thenReturn(List.of(snakeyaml133));
        when(provider.findVulnerabilities(any())).thenReturn(List.of(finding));
        listener.failOnCompleted = true;

        SecurityScanResult result = orchestrator.scan();

        assertThat(result.scan().status()).isEqualTo(COMPLETED);
    }

    @Test
    void providerNameFailureProducesFailedResult() {
        when(provider.name()).thenThrow(new IllegalStateException("no name"));
        when(collector.collect()).thenReturn(List.of(snakeyaml133));
        when(provider.findVulnerabilities(any())).thenThrow(new IllegalStateException("no name either"));

        SecurityScanResult result = orchestrator.scan();

        assertThat(result.scan().status()).isEqualTo(FAILED);
        assertThat(result.scan().dataSource()).isEqualTo("unknown");
    }

    private static final class RecordingListener implements SecurityScanListener {
        final List<SecurityScan> started = new CopyOnWriteArrayList<>();
        final List<SecurityScanResult> completed = new CopyOnWriteArrayList<>();
        volatile boolean failOnCompleted;

        @Override
        public void onSecurityScanStarted(SecurityScan scan) {
            started.add(scan);
        }

        @Override
        public void onSecurityScanCompleted(SecurityScanResult result) {
            completed.add(result);
            if (failOnCompleted) {
                throw new IllegalStateException("listener boom");
            }
        }
    }
}
