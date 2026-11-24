package com.sdlcpro.springlens.insight.jdbc;

import org.junit.jupiter.api.Test;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RandomSqlExecutionIdGeneratorTest {

    @Test
    void getDefaultInstance_returnsSingletonImplementation() {
        SqlExecutionIdGenerator generator = SqlExecutionIdGenerator.getDefaultInstance();

        assertSame(RandomSqlExecutionIdGenerator.getInstance(), generator);
        assertSame(generator, SqlExecutionIdGenerator.getDefaultInstance());
    }

    @Test
    void getInstance_returnsSameInstance() {
        RandomSqlExecutionIdGenerator generator = RandomSqlExecutionIdGenerator.getInstance();

        assertSame(generator, RandomSqlExecutionIdGenerator.getInstance());
    }

    @Test
    void generate_returnsSixteenLowercaseHexCharacters() {
        SqlExecutionIdGenerator generator = SqlExecutionIdGenerator.getDefaultInstance();

        for (int i = 0; i < 100; i++) {
            String id = generator.generate();

            assertNotNull(id);
            assertTrue(id.matches("[0-9a-f]{16}"));
        }
    }

    @Test
    void generate_producesUniqueIdsInSample() {
        SqlExecutionIdGenerator generator = SqlExecutionIdGenerator.getDefaultInstance();
        Set<String> ids = new HashSet<>();
        int count = 1_000;

        for (int i = 0; i < count; i++) {
            ids.add(generator.generate());
        }

        assertEquals(count, ids.size());
    }

    @Test
    void constructor_rejectsReflectiveInstantiation() throws Exception {
        RandomSqlExecutionIdGenerator generator = RandomSqlExecutionIdGenerator.getInstance();
        var constructor = RandomSqlExecutionIdGenerator.class.getDeclaredConstructor();
        constructor.setAccessible(true);

        InvocationTargetException exception = assertThrows(
                InvocationTargetException.class, constructor::newInstance);

        assertInstanceOf(IllegalStateException.class, exception.getCause());
        assertSame(generator, RandomSqlExecutionIdGenerator.getInstance());
    }

    @Test
    void singletonClass_isFinalWithOnePrivateConstructor() throws Exception {
        assertTrue(Modifier.isFinal(RandomSqlExecutionIdGenerator.class.getModifiers()));
        assertEquals(1, RandomSqlExecutionIdGenerator.class.getDeclaredConstructors().length);
        assertTrue(Modifier.isPrivate(
                RandomSqlExecutionIdGenerator.class.getDeclaredConstructor().getModifiers()));
    }

    @Test
    void concurrentAccess_preservesSingletonAndGeneratesUniqueIds() throws Exception {
        RandomSqlExecutionIdGenerator generator = RandomSqlExecutionIdGenerator.getInstance();
        int threadCount = 8;
        int idsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Set<String>>> futures = new ArrayList<>();

        try {
            for (int i = 0; i < threadCount; i++) {
                futures.add(executor.submit(() -> {
                    assertTrue(start.await(10, TimeUnit.SECONDS), "Workers did not receive the start signal");
                    RandomSqlExecutionIdGenerator instance = RandomSqlExecutionIdGenerator.getInstance();
                    assertSame(generator, instance);
                    assertSame(instance, SqlExecutionIdGenerator.getDefaultInstance());
                    Set<String> ids = new HashSet<>();

                    for (int j = 0; j < idsPerThread; j++) {
                        String id = instance.generate();
                        assertNotNull(id);
                        assertTrue(id.matches("[0-9a-f]{16}"));
                        assertTrue(ids.add(id), "Generated a duplicate ID within a worker");
                    }

                    return ids;
                }));
            }

            start.countDown();
            Set<String> ids = new HashSet<>();
            for (Future<Set<String>> future : futures) {
                for (String id : future.get(15, TimeUnit.SECONDS)) {
                    assertTrue(ids.add(id), "Generated a duplicate ID across workers");
                }
            }

            assertEquals(threadCount * idsPerThread, ids.size());
        } finally {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS), "Worker threads did not terminate");
        }
    }
}
