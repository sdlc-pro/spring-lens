package com.sdlcpro.springlens.ai;

import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.util.jar.JarFile;
import javax.xml.parsers.DocumentBuilderFactory;
import static org.assertj.core.api.Assertions.*;

class AiPackagingIT {
    @Test void jarContainsIndependentAutoConfigurationAndJava17Classes() throws Exception {
        Path jar;
        try (var files = Files.list(Path.of("target"))) {
            jar = files.filter(path -> path.getFileName().toString().matches("spring-lens-ai-[0-9].*(?<!-sources)(?<!-javadoc)\\.jar"))
                    .findFirst().orElseThrow();
        }
        try (var archive = new JarFile(jar.toFile())) {
            var entry = archive.getJarEntry("META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports");
            assertThat(entry).isNotNull();
            assertThat(new String(archive.getInputStream(entry).readAllBytes(), java.nio.charset.StandardCharsets.UTF_8))
                    .contains(SpringLensAiAutoConfiguration.class.getName());
            byte[] bytes = archive.getInputStream(archive.getJarEntry("com/sdlcpro/springlens/ai/AiInsightService.class")).readAllBytes();
            assertThat((bytes[6] & 255) * 256 + (bytes[7] & 255)).isEqualTo(61);
            assertThat(archive.stream().map(java.util.zip.ZipEntry::getName))
                    .noneMatch(name -> name.startsWith("org/springframework/ai/"));
        }
    }

    @Test void existingModulesDoNotAcquireAiDependencies() throws Exception {
        for (String module : java.util.List.of("core", "storage", "insight", "exposure", "autoconfigure", "starter", "ui")) {
            Path pom = Path.of("..", "spring-lens-" + module, ".flattened-pom.xml");
            if (!Files.exists(pom)) pom = pom.resolveSibling("pom.xml");
            var document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(pom.toFile());
            var dependencies = document.getElementsByTagName("dependency");
            for (int i = 0; i < dependencies.getLength(); i++) {
                String dependency = dependencies.item(i).getTextContent();
                assertThat(dependency).doesNotContain("spring-lens-ai", "org.springframework.ai");
            }
        }
    }
}
