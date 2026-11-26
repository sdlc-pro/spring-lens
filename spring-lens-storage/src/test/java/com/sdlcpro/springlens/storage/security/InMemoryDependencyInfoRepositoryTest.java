package com.sdlcpro.springlens.storage.security;

import com.sdlcpro.springlens.model.security.DependencyEcosystem;
import com.sdlcpro.springlens.model.security.DependencyEvaluationStatus;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import com.sdlcpro.springlens.query.Filters;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.query.Sort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InMemoryDependencyInfoRepositoryTest {

    private InMemoryDependencyInfoRepository repo;

    @BeforeEach
    void setUp() {
        repo = new InMemoryDependencyInfoRepository();
    }

    private static DependencyInfo dep(String group, String artifact, String version) {
        return new DependencyInfo(group, artifact, version, DependencyEcosystem.MAVEN, null,
                DependencyEvaluationStatus.NOT_EVALUATED);
    }

    @Test
    void saveThenFindByIdAndCount() {
        DependencyInfo d = dep("org.yaml", "snakeyaml", "1.33");
        repo.save(d);
        assertThat(repo.findById(new DependencyKey("org.yaml", "snakeyaml", "1.33"))).contains(d);
        assertThat(repo.count()).isEqualTo(1);
    }

    @Test
    void saveOverwritesSameKey() {
        repo.save(dep("a", "b", "1"));
        DependencyInfo evaluated = dep("a", "b", "1").withEvaluationStatus(DependencyEvaluationStatus.EVALUATED);
        repo.save(evaluated);
        assertThat(repo.count()).isEqualTo(1);
        assertThat(repo.findAll()).containsExactly(evaluated);
    }

    @Test
    void twoVersionsOfSameArtifactAreTwoEntries() {
        repo.save(dep("org.yaml", "snakeyaml", "1.33"));
        repo.save(dep("org.yaml", "snakeyaml", "2.2"));
        assertThat(repo.count()).isEqualTo(2);
    }

    @Test
    void replaceAllDropsEntriesMissingFromNewSet() {
        repo.save(dep("a", "old", "1"));
        repo.replaceAll(List.of(dep("a", "new", "1")));
        assertThat(repo.findAll()).extracting(DependencyInfo::artifactId).containsExactly("new");
    }

    @Test
    void findAllWithFilterAndPageRequest() {
        repo.save(dep("org.yaml", "snakeyaml", "1.33"));
        repo.save(dep("org.yaml", "snakeyaml", "2.2"));
        repo.save(dep("com.other", "lib", "1"));
        PageResponse<DependencyInfo> page = repo.findAll(Filters.eq("groupId", "org.yaml"),
                new PageRequest(0, 10, Sort.unsorted()));
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).extracting(DependencyInfo::groupId).containsOnly("org.yaml");
    }

    @Test
    void deleteByIdThrowsUnsupported() {
        assertThatThrownBy(() -> repo.deleteById(new DependencyKey("a", "b", "1")))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("Dependencies are not allowed to remove");
    }

    private static List<DependencyInfo> set(String prefix, int size) {
        List<DependencyInfo> list = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            list.add(dep("g", prefix + i, "1"));
        }
        return list;
    }

    @Test
    void findAllPreservesInsertionAndReplaceAllOrder() {
        List<DependencyInfo> a = set("a", 20);
        a.forEach(repo::save);
        assertThat(repo.findAll()).containsExactlyElementsOf(a);
        List<DependencyInfo> b = set("b", 30);
        repo.replaceAll(b);
        assertThat(repo.findAll()).containsExactlyElementsOf(b);
    }

    @Test
    void replaceAllIsAtomicForConcurrentReaders() throws Exception {
        List<DependencyInfo> setA = set("a", 50);
        List<DependencyInfo> setB = set("b", 200);
        repo.replaceAll(setA);
        ExecutorService pool = Executors.newFixedThreadPool(5);
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<String> failure = new AtomicReference<>();
        List<Future<?>> futures = new ArrayList<>();
        futures.add(pool.submit(() -> {
            start.await();
            for (int i = 0; i < 2000; i++) {
                repo.replaceAll(i % 2 == 0 ? setB : setA);
            }
            return null;
        }));
        for (int r = 0; r < 4; r++) {
            futures.add(pool.submit(() -> {
                start.await();
                for (int i = 0; i < 2000; i++) {
                    List<DependencyInfo> seen = repo.findAll();
                    if (!seen.equals(setA) && !seen.equals(setB)) {
                        failure.compareAndSet(null, "observed partial set of size " + seen.size());
                    }
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        pool.shutdownNow();
        assertThat(failure.get()).isNull();
    }

    @Test
    void concurrentSavesOfDistinctKeysLoseNoUpdates() throws Exception {
        int threads = 8;
        int perThread = 200;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            List<DependencyInfo> items = set("t" + t + "-", perThread);
            futures.add(pool.submit(() -> {
                start.await();
                items.forEach(repo::save);
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        pool.shutdownNow();
        assertThat(repo.count()).isEqualTo((long) threads * perThread);
    }}
