package com.sdlcpro.springlens.insight.security;

import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;

import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.UNRESOLVED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClasspathDependencyInventoryCollectorTest {

    @TempDir
    Path tempDir;

    private final JarDependencyReader reader = new JarDependencyReader();

    @Test
    void collectsEveryJarVisibleThroughManifestResourcesSorted() throws Exception {
        Path yaml = jar("snakeyaml-1.33.jar", pom("org.yaml", "snakeyaml", "1.33"));
        Path alpha = jar("alpha-1.0.jar", pom("com.acme", "alpha", "1.0"));

        List<DependencyInfo> deps = collector(yaml, alpha).collect();

        assertThat(deps).extracting(DependencyInfo::key)
                .containsExactly(key("com.acme", "alpha", "1.0"), key("org.yaml", "snakeyaml", "1.33"));
        assertThatThrownBy(() -> deps.add(deps.get(0))).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void deduplicatesSameCoordinateOnTwoPaths() throws Exception {
        Path first = jar("a/alpha-1.0.jar", pom("com.acme", "alpha", "1.0"));
        Path second = jar("b/alpha-1.0.jar", pom("com.acme", "alpha", "1.0"));

        assertThat(collector(first, second).collect()).hasSize(1);
    }

    @Test
    void includesUnresolvedJarsAfterResolvedOnes() throws Exception {
        Path tools = jar("tools.jar", Map.of());
        Path alpha = jar("alpha-1.0.jar", pom("com.acme", "alpha", "1.0"));

        List<DependencyInfo> deps = collector(tools, alpha).collect();

        assertThat(deps).hasSize(2);
        assertThat(deps.get(0).artifactId()).isEqualTo("alpha");
        assertThat(deps.get(1).artifactId()).isEqualTo("tools");
        assertThat(deps.get(1).evaluationStatus()).isEqualTo(UNRESOLVED);
    }

    @Test
    void returnsEmptyListWhenClassLoaderHasNoJars() {
        var collector = new ClasspathDependencyInventoryCollector(new URLClassLoader(new URL[0], null), reader);

        assertThat(collector.collect()).isEmpty();
    }

    @Test
    void stripsManifestUrlToJarRoot() {
        assertThat(ClasspathDependencyInventoryCollector.jarRoot("jar:file:/x/a.jar!/META-INF/MANIFEST.MF"))
                .isEqualTo("jar:file:/x/a.jar!/");
        assertThat(ClasspathDependencyInventoryCollector
                .jarRoot("jar:nested:/app.jar/!BOOT-INF/lib/a.jar!/META-INF/MANIFEST.MF"))
                .isEqualTo("jar:nested:/app.jar/!BOOT-INF/lib/a.jar!/");
    }

    private ClasspathDependencyInventoryCollector collector(Path... jars) throws Exception {
        URL[] urls = new URL[jars.length];
        for (int i = 0; i < jars.length; i++) {
            urls[i] = jars[i].toUri().toURL();
        }
        return new ClasspathDependencyInventoryCollector(new URLClassLoader(urls, null), reader);
    }

    private static DependencyKey key(String g, String a, String v) {
        return new DependencyKey(g, a, v);
    }

    private static Map<String, String> pom(String g, String a, String v) {
        return Map.of("META-INF/maven/" + g + "/" + a + "/pom.properties",
                "groupId=" + g + "\nartifactId=" + a + "\nversion=" + v + "\n");
    }

    private Path jar(String name, Map<String, String> extra) {
        Path path = tempDir.resolve(name);
        try {
            Files.createDirectories(path.getParent());
            Map<String, String> entries = new LinkedHashMap<>();
            entries.put("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n\n");
            entries.putAll(extra);
            try (JarOutputStream out = new JarOutputStream(Files.newOutputStream(path))) {
                for (Map.Entry<String, String> e : entries.entrySet()) {
                    out.putNextEntry(new JarEntry(e.getKey()));
                    out.write(e.getValue().getBytes(StandardCharsets.UTF_8));
                    out.closeEntry();
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return path;
    }
}
