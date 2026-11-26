package com.sdlcpro.springlens.insight.security;

import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;

import static com.sdlcpro.springlens.model.security.DependencyEcosystem.MAVEN;
import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.NOT_EVALUATED;
import static com.sdlcpro.springlens.model.security.DependencyEvaluationStatus.UNRESOLVED;
import static org.assertj.core.api.Assertions.assertThat;

class JarDependencyReaderTest {

    @TempDir
    Path tempDir;

    private final JarDependencyReader reader = new JarDependencyReader();

    @Test
    void readsCoordinatesFromPomProperties() throws Exception {
        Path jar = jar("snakeyaml-1.33.jar", Map.of(
                "META-INF/maven/org.yaml/snakeyaml/pom.properties",
                "groupId=org.yaml\nartifactId=snakeyaml\nversion=1.33\n"));

        DependencyInfo info = reader.read(jarUrl(jar));

        assertThat(info.groupId()).isEqualTo("org.yaml");
        assertThat(info.artifactId()).isEqualTo("snakeyaml");
        assertThat(info.version()).isEqualTo("1.33");
        assertThat(info.ecosystem()).isEqualTo(MAVEN);
        assertThat(info.evaluationStatus()).isEqualTo(NOT_EVALUATED);
        assertThat(info.location()).isEqualTo(jarUrl(jar).toString());
    }

    @Test
    void shadedJarPrefersPomPropertiesMatchingFileName() throws Exception {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("META-INF/maven/com.guava/guava/pom.properties",
                "groupId=com.guava\nartifactId=guava\nversion=31.1\n");
        entries.put("META-INF/maven/com.acme/mytool/pom.properties",
                "groupId=com.acme\nartifactId=mytool\nversion=2.0\n");
        Path jar = jar("mytool-2.0.jar", entries);

        assertThat(reader.read(jarUrl(jar)).key()).isEqualTo(new DependencyKey("com.acme", "mytool", "2.0"));
    }

    @Test
    void shadedJarPrefersLongestArtifactIdMatchingFileName() throws Exception {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("META-INF/maven/com.x/foo/pom.properties",
                "groupId=com.x\nartifactId=foo\nversion=9.9\n");
        entries.put("META-INF/maven/com.x/foo-bar/pom.properties",
                "groupId=com.x\nartifactId=foo-bar\nversion=1.0\n");
        Path jar = jar("foo-bar-1.0.jar", entries);

        assertThat(reader.read(jarUrl(jar)).key()).isEqualTo(new DependencyKey("com.x", "foo-bar", "1.0"));
    }

    @Test
    void shadedJarWithoutFileNameMatchTakesFirstEntry() throws Exception {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("META-INF/maven/com.guava/guava/pom.properties",
                "groupId=com.guava\nartifactId=guava\nversion=31.1\n");
        entries.put("META-INF/maven/com.acme/other/pom.properties",
                "groupId=com.acme\nartifactId=other\nversion=2.0\n");
        Path jar = jar("bundle-all.jar", entries);

        assertThat(reader.read(jarUrl(jar)).key()).isEqualTo(new DependencyKey("com.guava", "guava", "31.1"));
    }

    @Test
    void fallsBackToFileNameWhenNoPomProperties() throws Exception {
        Path jar = jar("spring-core-6.1.0.jar", Map.of());

        DependencyInfo info = reader.read(jarUrl(jar));

        assertThat(info.groupId()).isNull();
        assertThat(info.artifactId()).isEqualTo("spring-core");
        assertThat(info.version()).isEqualTo("6.1.0");
        assertThat(info.evaluationStatus()).isEqualTo(UNRESOLVED);
        assertThat(info.location()).isEqualTo(jarUrl(jar).toString());
    }

    @Test
    void incompletePomPropertiesFallsBackToFileName() throws Exception {
        Path jar = jar("lib-1.2.jar", Map.of("META-INF/maven/a/lib/pom.properties", "groupId=a\nartifactId=lib\n"));

        DependencyInfo info = reader.read(jarUrl(jar));

        assertThat(info.groupId()).isNull();
        assertThat(info.artifactId()).isEqualTo("lib");
        assertThat(info.version()).isEqualTo("1.2");
        assertThat(info.evaluationStatus()).isEqualTo(UNRESOLVED);
    }

    @Test
    void unparseableFileNameIsUnresolvedWithStemAsArtifactId() throws Exception {
        DependencyInfo info = reader.read(jarUrl(jar("tools.jar", Map.of())));

        assertThat(info.artifactId()).isEqualTo("tools");
        assertThat(info.version()).isNull();
        assertThat(info.evaluationStatus()).isEqualTo(UNRESOLVED);
    }

    @ParameterizedTest
    @CsvSource({
            "jackson-databind-2.15.3.jar,jackson-databind,2.15.3",
            "spring-boot-3.2.0-SNAPSHOT.jar,spring-boot,3.2.0-SNAPSHOT",
            "lib-1.0.0.RELEASE.jar,lib,1.0.0.RELEASE"
    })
    void parseFileNameSplitsAtFirstDashFollowedByDigit(String file, String artifact, String version) {
        DependencyInfo info = JarDependencyReader.parseFileName(file).orElseThrow();

        assertThat(info.groupId()).isNull();
        assertThat(info.artifactId()).isEqualTo(artifact);
        assertThat(info.version()).isEqualTo(version);
        assertThat(info.evaluationStatus()).isEqualTo(UNRESOLVED);
        assertThat(info.location()).isNull();
    }

    @Test
    void fileNameIsDerivedFromBootNestedUrl() {
        assertThat(JarDependencyReader.fileNameFromUrl("jar:nested:/app.jar/!BOOT-INF/lib/snakeyaml-1.33.jar!/"))
                .isEqualTo("snakeyaml-1.33.jar");
        assertThat(JarDependencyReader.fileNameFromUrl("jar:file:/x/snakeyaml-1.33.jar!/"))
                .isEqualTo("snakeyaml-1.33.jar");
    }

    @Test
    void unreadableJarIsUnresolved() throws MalformedURLException {
        URL url = new URL("jar:" + tempDir.resolve("missing-3.1.jar").toUri() + "!/");

        DependencyInfo info = reader.read(url);

        assertThat(info.groupId()).isNull();
        assertThat(info.artifactId()).isEqualTo("missing");
        assertThat(info.version()).isEqualTo("3.1");
        assertThat(info.evaluationStatus()).isEqualTo(UNRESOLVED);
    }

    private URL jarUrl(Path path) throws MalformedURLException {
        return new URL("jar:" + path.toUri() + "!/");
    }

    private Path jar(String name, Map<String, String> entries) {
        Path path = tempDir.resolve(name);
        try (JarOutputStream out = new JarOutputStream(Files.newOutputStream(path))) {
            for (Map.Entry<String, String> e : entries.entrySet()) {
                out.putNextEntry(new JarEntry(e.getKey()));
                out.write(e.getValue().getBytes(StandardCharsets.UTF_8));
                out.closeEntry();
            }
            if (entries.isEmpty()) {
                out.putNextEntry(new JarEntry("placeholder.txt"));
                out.closeEntry();
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return path;
    }
}
