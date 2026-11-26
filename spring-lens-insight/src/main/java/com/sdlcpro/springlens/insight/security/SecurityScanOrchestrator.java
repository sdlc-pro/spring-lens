package com.sdlcpro.springlens.insight.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.inspector.security.DependencyInventoryCollector;
import com.sdlcpro.springlens.inspector.security.VulnerabilityDataProvider;
import com.sdlcpro.springlens.insight.util.SafeListenerInvoker;
import com.sdlcpro.springlens.listener.security.SecurityScanListener;
import com.sdlcpro.springlens.model.security.DependencyEvaluationStatus;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.SecurityScan;
import com.sdlcpro.springlens.model.security.SecurityScanResult;
import com.sdlcpro.springlens.model.security.VulnerabilityFinding;
import com.sdlcpro.springlens.time.SpringLensClock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * Orchestrates a dependency vulnerability scan: collects the dependency inventory, evaluates the
 * resolved dependencies against a {@link VulnerabilityDataProvider} and publishes the outcome to
 * {@link SecurityScanListener}s.
 *
 * <p>When enabled, a scan is started on a background thread once the application is ready. A scan
 * never throws and never affects application startup.</p>
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
public class SecurityScanOrchestrator implements ApplicationListener<ApplicationReadyEvent>, DisposableBean {

    private static final Logger logger = LoggerFactory.getLogger(SecurityScanOrchestrator.class);
    private static final String UNKNOWN_DATA_SOURCE = "unknown";
    private static final String THREAD_NAME = "spring-lens-security-scan";

    private final DependencyInventoryCollector collector;
    private final VulnerabilityDataProvider provider;
    private final SecurityScanSettings settings;
    private final ObjectProvider<SecurityScanListener> listeners;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, THREAD_NAME);
        thread.setDaemon(true);
        return thread;
    });

    /**
     * Creates the orchestrator.
     *
     * @param collector dependency inventory collector
     * @param provider  vulnerability data provider
     * @param settings  scan settings
     * @param listeners scan listeners
     */
    public SecurityScanOrchestrator(DependencyInventoryCollector collector, VulnerabilityDataProvider provider,
                                    SecurityScanSettings settings, ObjectProvider<SecurityScanListener> listeners) {
        this.collector = collector;
        this.provider = provider;
        this.settings = settings;
        this.listeners = listeners;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (!settings.scanOnStartup()) {
            return;
        }
        try {
            executor.execute(this::runSafely);
        } catch (RejectedExecutionException ex) {
            logger.debug("Security scan not started, executor is shut down");
        }
    }

    /**
     * Runs a scan synchronously. Scans never run concurrently with each other.
     *
     * @return scan outcome, never {@code null}; failures are reported as a {@code FAILED} scan
     */
    public synchronized SecurityScanResult scan() {
        Instant startedAt = SpringLensClock.getClock().now();
        SecurityScan running = SecurityScan.running(UUID.randomUUID().toString(), dataSourceName(), startedAt);
        publishStarted(running);

        SecurityScanResult result;
        try {
            result = execute(running);
        } catch (RuntimeException ex) {
            result = failed(running, Duration.ZERO, List.of(), ex);
        }
        publishCompleted(result);
        return result;
    }

    private String dataSourceName() {
        try {
            String name = provider.name();
            return name == null ? UNKNOWN_DATA_SOURCE : name;
        } catch (RuntimeException ex) {
            logger.warn("Vulnerability data provider name unavailable: {}", ex.getMessage());
            return UNKNOWN_DATA_SOURCE;
        }
    }

    private void publishStarted(SecurityScan scan) {
        try {
            SafeListenerInvoker.invoke(listeners, scan, SecurityScanListener::onSecurityScanStarted);
        } catch (RuntimeException ex) {
            logger.warn("Publishing security scan start failed: {}", ex.getMessage(), ex);
        }
    }

    private void publishCompleted(SecurityScanResult result) {
        try {
            SafeListenerInvoker.invoke(listeners, result, SecurityScanListener::onSecurityScanCompleted);
        } catch (RuntimeException ex) {
            logger.warn("Publishing security scan result failed: {}", ex.getMessage(), ex);
        }
    }

    private void runSafely() {
        try {
            scan();
        } catch (Throwable ex) {
            logger.error("Security scan terminated unexpectedly: {}", ex.getMessage(), ex);
            if (ex instanceof VirtualMachineError error) {
                throw error;
            }
        }
    }

    private SecurityScanResult execute(SecurityScan running) {
        long inventoryStart = SpringLensClock.nanoTime();
        List<DependencyInfo> inventory;
        try {
            inventory = List.copyOf(collector.collect());
        } catch (RuntimeException ex) {
            Duration inventoryDuration = elapsedSince(inventoryStart);
            return failed(running, inventoryDuration, List.of(), ex);
        }
        Duration inventoryDuration = elapsedSince(inventoryStart);

        List<DependencyInfo> resolved = inventory.stream().filter(DependencyInfo::resolved).toList();
        long evaluationStart = SpringLensClock.nanoTime();
        List<VulnerabilityFinding> findings;
        try {
            findings = resolved.isEmpty() ? List.of() : List.copyOf(provider.findVulnerabilities(resolved));
        } catch (RuntimeException ex) {
            return failed(running, inventoryDuration, inventory, ex);
        }
        Duration evaluationDuration = elapsedSince(evaluationStart);

        List<DependencyInfo> evaluated = inventory.stream()
                .map(d -> d.resolved() ? d.withEvaluationStatus(DependencyEvaluationStatus.EVALUATED) : d)
                .toList();
        SecurityScan completed = running.completed(SpringLensClock.getClock().now(), inventoryDuration,
                evaluationDuration, evaluated, findings);
        logger.info("Security scan {} completed: {} dependencies, {} findings, inventory {} ms, evaluation {} ms",
                completed.id(), completed.dependencyCount(), completed.findingCount(),
                inventoryDuration.toMillis(), evaluationDuration.toMillis());
        return new SecurityScanResult(completed, evaluated, findings);
    }

    private SecurityScanResult failed(SecurityScan running, Duration inventoryDuration,
                                      List<DependencyInfo> inventory, RuntimeException ex) {
        String message = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getName();
        SecurityScan failed = running.failed(SpringLensClock.getClock().now(), inventoryDuration, inventory, message);
        logger.warn("Security scan {} failed: {}", failed.id(), message);
        return new SecurityScanResult(failed, inventory, List.of());
    }

    private static Duration elapsedSince(long startNanos) {
        return Duration.ofNanos(SpringLensClock.elapsedNanos(startNanos));
    }

    @Override
    public void destroy() {
        executor.shutdownNow();
    }
}
