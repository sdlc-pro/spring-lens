package com.sdlcpro.springlens.exposure;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpringLensMediaTypeTest {

    @Test
    void exposesVendorJsonStringValues() {
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_VALUE)
                .isEqualTo("application/vnd.sdlc-pro.spring-lens.v2+json");
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8_VALUE)
                .isEqualTo("application/vnd.sdlc-pro.spring-lens.v2+json;charset=UTF-8");
    }

    @Test
    void initializesVendorJsonMediaType() {
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON).isNotNull();
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON.getType()).isEqualTo("application");
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON.getSubtype())
                .isEqualTo("vnd.sdlc-pro.spring-lens.v2+json");
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON.getCharset()).isNull();
    }

    @Test
    void initializesVendorJsonMediaTypeWithUtf8Charset() {
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8).isNotNull();
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8.getType()).isEqualTo("application");
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8.getSubtype())
                .isEqualTo("vnd.sdlc-pro.spring-lens.v2+json");
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8.getCharset())
                .isEqualTo(StandardCharsets.UTF_8);
    }

    @Test
    void rendersMediaTypesAsTheirStringValues() {
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON)
                .hasToString(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_VALUE);
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8)
                .hasToString(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8_VALUE);
    }

    @Test
    void isNotStandardApplicationJson() {
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON).isNotEqualTo(MediaType.APPLICATION_JSON);
        assertThat(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON.isCompatibleWith(MediaType.APPLICATION_JSON))
                .isFalse();
    }

    @Test
    void isStillClaimedByWildcardJsonConverters() {
        assertThat(new MediaType("application", "*+json")
                .isCompatibleWith(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON)).isTrue();
    }

    @Test
    void parsesBackToTheSameMediaType() {
        assertThat(MediaType.parseMediaType(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_VALUE))
                .isEqualTo(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON);
        assertThat(MediaType.parseMediaType(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8_VALUE))
                .isEqualTo(SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8);
    }

    @Test
    void cannotBeInstantiated() throws NoSuchMethodException {
        Constructor<SpringLensMediaType> constructor = SpringLensMediaType.class.getDeclaredConstructor();
        assertThat(Modifier.isPrivate(constructor.getModifiers())).isTrue();

        constructor.setAccessible(true);
        assertThatThrownBy(constructor::newInstance)
                .isInstanceOf(InvocationTargetException.class)
                .cause()
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("SpringLensMediaType is an utility class and cannot be instantiated");
    }

    @RequestMapping(produces = {
            SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_VALUE,
            SpringLensMediaType.APPLICATION_SPRING_LENS_JSON_UTF8_VALUE
    })
    private static final class ConstantsAreUsableInAnnotations {
    }
}
