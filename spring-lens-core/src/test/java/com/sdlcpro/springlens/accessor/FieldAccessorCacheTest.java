package com.sdlcpro.springlens.accessor;

import com.sdlcpro.springlens.exception.AccessorCreationException;
import com.sdlcpro.springlens.exception.DataAccessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.*;

class FieldAccessorCacheTest {

    @BeforeEach
    void setUp() {
        FieldAccessorCache.clear();
    }

    @Test
    void shouldRejectNullRootType() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> FieldAccessorCache.getAccessor(null, "name"))
                .withMessage("The value of rootType must not be null");
    }

    @Test
    void shouldRejectNullFieldPath() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> FieldAccessorCache.getAccessor(Person.class, null))
                .withMessage("The value of fieldPath must not be blank");
    }

    @Test
    void shouldRejectBlankFieldPath() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> FieldAccessorCache.getAccessor(Person.class, "  "))
                .withMessage("The value of fieldPath must not be blank");
    }

    @Test
    void shouldRejectEmptyFieldPathSegments() {
        List<String> invalidPaths = List.of(
                ".name",
                "name.",
                "name..value",
                "name...value"
        );

        for (String path : invalidPaths) {
            assertThatThrownBy(() ->
                    FieldAccessorCache.getAccessor(Person.class, path)
            ).isInstanceOf(AccessorCreationException.class)
                    .hasMessageContaining(path);
        }
    }

    @Test
    void shouldRejectUnknownProperty() {
        assertThatThrownBy(() ->
                FieldAccessorCache.getAccessor(Person.class, "unknown")
        ).isInstanceOf(AccessorCreationException.class)
                .hasMessageContaining("unknown");
    }

    @Test
    void shouldRejectInvalidNestedProperty() {
        assertThatThrownBy(() ->
                FieldAccessorCache.getAccessor(Person.class, "address.unknown")
        ).isInstanceOf(AccessorCreationException.class)
                .hasMessageContaining("address.unknown");
    }

    @Test
    void shouldAccessSimpleProperty() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Person.class, "name");
        Person person = new Person("Abdullah");
        assertThat(accessor.apply(person)).isEqualTo("Abdullah");
    }

    @Test
    void shouldAccessNestedProperty() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Person.class, "address.city");
        Person person = new Person("Abdullah", new Address("Dhaka"));
        assertThat(accessor.apply(person)).isEqualTo("Dhaka");
    }

    @Test
    void shouldAccessDeeplyNestedProperty() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(
                Person.class,
                "address.location.country.name"
        );

        Person person = new Person("Abdullah",
                new Address(
                        new Location(
                                new Country("Bangladesh")
                        )
                )
        );

        assertThat(accessor.apply(person)).isEqualTo("Bangladesh");
    }

    @Test
    void shouldAccessBooleanPropertyUsingIsGetter() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Person.class, "active");
        Person person = new Person("Abdullah", true);
        assertThat(accessor.apply(person)).isEqualTo(true);
    }

    @Test
    void shouldAccessBooleanPropertyUsingGetGetter() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Person.class, "verified");
        Person person = new Person("Abdullah", false, true);
        assertThat(accessor.apply(person)).isEqualTo(true);
    }

    @Test
    void shouldAccessRecordComponent() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(RecordPerson.class, "name");
        RecordPerson person = new RecordPerson("Abdullah");
        assertThat(accessor.apply(person)).isEqualTo("Abdullah");
    }

    @Test
    void shouldAccessInheritedProperty() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Employee.class, "name");
        Employee employee = new Employee("Abdullah", 1001);
        assertThat(accessor.apply(employee)).isEqualTo("Abdullah");
    }

    @Test
    void shouldReturnNullWhenRootObjectIsNull() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Person.class, "name");
        assertThat(accessor.apply(null)).isNull();
    }

    @Test
    void shouldReturnNullWhenIntermediatePropertyIsNull() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Person.class, "address.city");
        Person person = new Person("Abdullah", null);
        assertThat(accessor.apply(person)).isNull();
    }

    @Test
    void shouldReturnNullWhenFinalPropertyIsNull() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(Person.class, "address");
        Person person = new Person("Abdullah", null);
        assertThat(accessor.apply(person)).isNull();
    }

    @Test
    void shouldAccessPropertyFromCollectionElements() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonGroup.class, "people.name");

        PersonGroup group = new PersonGroup(List.of(
                new Person("Alice"),
                new Person("Bob"),
                new Person("Charlie")
        ));

        assertThat(accessor.apply(group)).asList().containsExactly("Alice", "Bob", "Charlie");
    }

    @Test
    void shouldAccessNestedPropertyFromCollectionElements() {
        Function<Object, Object> accessor =
                FieldAccessorCache.getAccessor(
                        PersonGroup.class,
                        "people.address.city"
                );

        PersonGroup group = new PersonGroup(List.of(
                new Person("Alice", new Address("Dhaka")),
                new Person("Bob", new Address("Chittagong"))
        ));

        assertThat(accessor.apply(group)).asList().containsExactly("Dhaka", "Chittagong");
    }

    @Test
    void shouldFlattenNestedCollections() {
        Function<Object, Object> accessor =
                FieldAccessorCache.getAccessor(
                        NestedPersonGroup.class,
                        "groups.name"
                );

        NestedPersonGroup group = new NestedPersonGroup(List.of(
                List.of(
                        new Person("Alice"),
                        new Person("Bob")
                ),
                List.of(
                        new Person("Charlie")
                )
        ));

        assertThat(accessor.apply(group)).asList().containsExactly("Alice", "Bob", "Charlie");
    }

    @Test
    void shouldReturnEmptyListForEmptyCollection() {
        Function<Object, Object> accessor =
                FieldAccessorCache.getAccessor(PersonGroup.class, "people.name");

        PersonGroup group = new PersonGroup(Collections.emptyList());

        assertThat(accessor.apply(group))
                .isEqualTo(Collections.emptyList());
    }

    @Test
    void shouldPreserveNullElementsDuringCollectionTraversal() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonGroup.class, "people.name");

        PersonGroup group = new PersonGroup(
                Arrays.asList(
                        new Person("Alice"),
                        null,
                        new Person("Bob")
                )
        );

        assertThat(accessor.apply(group)).asList().containsExactly("Alice", null, "Bob");
    }

    @Test
    void shouldAccessCollectionPropertyWithoutFurtherPath() {
        Function<Object, Object> accessor =
                FieldAccessorCache.getAccessor(PersonGroup.class, "people");

        Person alice = new Person("Alice");
        Person bob = new Person("Bob");

        PersonGroup group = new PersonGroup(List.of(alice, bob));

        assertThat(accessor.apply(group)).asList().containsExactly(alice, bob);
    }

    @Test
    void shouldAccessPropertyFromArrayElements() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonArrayGroup.class, "people.name");

        PersonArrayGroup group = new PersonArrayGroup(
                new Person[]{
                        new Person("Alice"),
                        new Person("Bob")
                }
        );

        assertThat(accessor.apply(group)).asList().containsExactly("Alice", "Bob");
    }

    @Test
    void shouldAccessPropertyFromMultidimensionalArrays() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(
                PersonMatrix.class,
                "people.name"
        );

        PersonMatrix matrix = new PersonMatrix(
                new Person[][]{
                        {new Person("Alice"), new Person("Bob")},
                        {new Person("Charlie")}
                }
        );

        assertThat(accessor.apply(matrix)).asList().containsExactly("Alice", "Bob", "Charlie");
    }

    @Test
    void shouldSupportPrimitiveArraysAsContainers() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(
                IntegerArrayHolder.class,
                "numbers"
        );

        IntegerArrayHolder holder = new IntegerArrayHolder(new int[]{10, 20, 30});
        assertThat(accessor.apply(holder)).asList().containsExactly(10, 20, 30);
    }

    @Test
    void shouldReturnEmptyListForEmptyArray() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonArrayGroup.class, "people.name");

        PersonArrayGroup group = new PersonArrayGroup(new Person[0]);

        assertThat(accessor.apply(group)).isEqualTo(Collections.emptyList());
    }

    // ---------------------------------------------------------
    // 6. Map traversal
    // ---------------------------------------------------------

    @Test
    void shouldAccessPropertyFromMapValues() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonMapHolder.class, "people.name");

        Map<String, Person> people = new LinkedHashMap<>();
        people.put("first", new Person("Alice"));
        people.put("second", new Person("Bob"));

        PersonMapHolder holder = new PersonMapHolder(people);

        assertThat(accessor.apply(holder)).asList().containsExactly("Alice", "Bob");
    }

    @Test
    void shouldAccessNestedPropertyFromMapValues() {
        Function<Object, Object> accessor =
                FieldAccessorCache.getAccessor(
                        PersonMapHolder.class,
                        "people.address.city"
                );

        Map<String, Person> people = new LinkedHashMap<>();
        people.put("first", new Person("Alice", new Address("Dhaka")));
        people.put("second", new Person("Bob", new Address("Khulna")));

        PersonMapHolder holder = new PersonMapHolder(people);

        assertThat(accessor.apply(holder)).asList().containsExactly("Dhaka", "Khulna");
    }

    @Test
    void shouldAccessPropertyFromNestedMapCollectionValues() {
        Function<Object, Object> accessor =
                FieldAccessorCache.getAccessor(
                        NestedPersonMapHolder.class,
                        "groups.name"
                );

        Map<String, List<Person>> groups = new LinkedHashMap<>();
        groups.put("group1", List.of(
                new Person("Alice"),
                new Person("Bob")
        ));

        groups.put("group2", List.of(
                new Person("Charlie")
        ));

        NestedPersonMapHolder holder = new NestedPersonMapHolder(groups);

        assertThat(accessor.apply(holder)).asList().containsExactly("Alice", "Bob", "Charlie");
    }

    @Test
    void shouldReturnEmptyListForEmptyMap() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonMapHolder.class, "people.name");

        PersonMapHolder holder = new PersonMapHolder(Collections.emptyMap());

        assertThat(accessor.apply(holder)).isEqualTo(Collections.emptyList());
    }

    @Test
    void shouldPreserveNullMapValues() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonMapHolder.class, "people.name");

        Map<String, Person> people = new LinkedHashMap<>();
        people.put("first", new Person("Alice"));
        people.put("second", null);
        people.put("third", new Person("Bob"));

        PersonMapHolder holder = new PersonMapHolder(people);

        assertThat(accessor.apply(holder)).asList().containsExactly("Alice", null, "Bob");
    }

    @Test
    void shouldAccessMapValuesWithoutFurtherPath() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(PersonMapHolder.class, "people");

        Person alice = new Person("Alice");
        Person bob = new Person("Bob");

        Map<String, Person> people = new LinkedHashMap<>();
        people.put("first", alice);
        people.put("second", bob);

        PersonMapHolder holder = new PersonMapHolder(people);
        assertThat(accessor.apply(holder)).asList().containsExactly(alice, bob);
    }

    @Test
    void shouldResolveWildcardCollectionElementType() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(WildcardPersonGroup.class, "people.name");
        WildcardPersonGroup group = new WildcardPersonGroup(List.of(new Person("Alice"), new Person("Bob")));
        assertThat(accessor.apply(group)).asList().containsExactly("Alice", "Bob");
    }

    @Test
    void shouldResolveWildcardMapValueType() {
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(WildcardPersonMapHolder.class, "people.name");

        Map<String, Person> people = new LinkedHashMap<>();
        people.put("first", new Person("Alice"));
        people.put("second", new Person("Bob"));

        WildcardPersonMapHolder holder = new WildcardPersonMapHolder(people);

        assertThat(accessor.apply(holder)).asList().containsExactly("Alice", "Bob");
    }

    // ---------------------------------------------------------
    // 8. Cache behavior
    // ---------------------------------------------------------

    @Test
    void shouldCacheAccessorForSameRootTypeAndPath() {
        Function<Object, Object> first = FieldAccessorCache.getAccessor(Person.class, "name");
        Function<Object, Object> second = FieldAccessorCache.getAccessor(Person.class, "name");

        assertThat(first).isSameAs(second);
        assertThat(FieldAccessorCache.cacheSize()).isEqualTo(1);
    }

    @Test
    void shouldCacheDifferentPathsSeparately() {
        FieldAccessorCache.getAccessor(Person.class, "name");
        FieldAccessorCache.getAccessor(Person.class, "address");
        FieldAccessorCache.getAccessor(Person.class, "active");
        assertThat(FieldAccessorCache.cacheSize()).isEqualTo(3);
    }

    @Test
    void shouldCacheDifferentRootTypesSeparately() {
        FieldAccessorCache.getAccessor(Person.class, "name");
        FieldAccessorCache.getAccessor(Employee.class, "name");
        assertThat(FieldAccessorCache.cacheSize()).isEqualTo(2);
    }

    @Test
    void shouldClearCache() {
        FieldAccessorCache.getAccessor(Person.class, "name");
        FieldAccessorCache.getAccessor(Person.class, "address");
        assertThat(FieldAccessorCache.cacheSize()).isEqualTo(2);

        FieldAccessorCache.clear();
        assertThat(FieldAccessorCache.cacheSize()).isZero();
    }

    @Test
    void shouldRecreateAccessorAfterCacheClear() {
        Function<Object, Object> first = FieldAccessorCache.getAccessor(Person.class, "name");

        FieldAccessorCache.clear();
        Function<Object, Object> second = FieldAccessorCache.getAccessor(Person.class, "name");

        assertThat(second).isNotSameAs(first);
        assertThat(FieldAccessorCache.cacheSize()).isEqualTo(1);
    }

    @Test
    void shouldSupportConcurrentAccessorCreation() throws Exception {
        int threadCount = 20;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        try {
            List<Future<Function<Object, Object>>> futures = new ArrayList<>();

            for (int i = 0; i < threadCount; i++) {
                futures.add(executor.submit(
                        () -> FieldAccessorCache.getAccessor(Person.class, "name")
                ));
            }

            List<Function<Object, Object>> accessors = new ArrayList<>();
            for (Future<Function<Object, Object>> future : futures) {
                accessors.add(future.get());
            }

            Function<Object, Object> first = accessors.get(0);
            assertThat(accessors).allMatch(accessor -> accessor == first);
            assertThat(FieldAccessorCache.cacheSize()).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void shouldWrapRuntimeInvocationFailure() {
        Function<Object, Object> accessor =
                FieldAccessorCache.getAccessor(Person.class, "name");

        assertThatThrownBy(() -> accessor.apply("not-a-person"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("position 0");
    }

    public static class Person {
        private final String name;
        private final Address address;
        private final boolean active;
        private final boolean verified;

        public Person(String name) {
            this(name, null, false, false);
        }

        public Person(String name, Address address) {
            this(name, address, false, false);
        }

        public Person(String name, boolean active) {
            this(name, null, active, false);
        }

        public Person(String name, boolean active, boolean verified) {
            this(name, null, active, verified);
        }

        private Person(String name, Address address, boolean active, boolean verified) {
            this.name = name;
            this.address = address;
            this.active = active;
            this.verified = verified;
        }

        public String getName() {
            return name;
        }

        public Address getAddress() {
            return address;
        }

        public boolean isActive() {
            return active;
        }

        public boolean getVerified() {
            return verified;
        }
    }

    public static class Address {
        private final String city;
        private final Location location;

        public Address(String city) {
            this.city = city;
            this.location = null;
        }

        public Address(Location location) {
            this.city = null;
            this.location = location;
        }

        public String getCity() {
            return city;
        }

        public Location getLocation() {
            return location;
        }
    }

    public record Location(Country country) {

    }

    public record Country(String name) {

    }

    public static class Employee extends Person {
        private final long employeeId;

        public Employee(String name, long employeeId) {
            super(name);
            this.employeeId = employeeId;
        }

        public long getEmployeeId() {
            return employeeId;
        }
    }

    public record RecordPerson(String name) {

    }

    public static class PersonGroup {
        private final List<Person> people;

        public PersonGroup(List<Person> people) {
            this.people = people;
        }

        public List<Person> getPeople() {
            return people;
        }
    }

    public static class NestedPersonGroup {
        private final List<List<Person>> groups;

        public NestedPersonGroup(List<List<Person>> groups) {
            this.groups = groups;
        }

        public List<List<Person>> getGroups() {
            return groups;
        }
    }

    public static class PersonArrayGroup {
        private final Person[] people;

        public PersonArrayGroup(Person[] people) {
            this.people = people;
        }

        public Person[] getPeople() {
            return people;
        }
    }

    public static class PersonMatrix {
        private final Person[][] people;

        public PersonMatrix(Person[][] people) {
            this.people = people;
        }

        public Person[][] getPeople() {
            return people;
        }
    }

    public static class IntegerArrayHolder {
        private final int[] numbers;

        public IntegerArrayHolder(int[] numbers) {
            this.numbers = numbers;
        }

        public int[] getNumbers() {
            return numbers;
        }
    }

    public static class PersonMapHolder {
        private final Map<String, Person> people;

        public PersonMapHolder(Map<String, Person> people) {
            this.people = people;
        }

        public Map<String, Person> getPeople() {
            return people;
        }
    }

    public static class NestedPersonMapHolder {
        private final Map<String, List<Person>> groups;

        public NestedPersonMapHolder(Map<String, List<Person>> groups) {
            this.groups = groups;
        }

        public Map<String, List<Person>> getGroups() {
            return groups;
        }
    }

    public static class WildcardPersonGroup {
        private final List<? extends Person> people;

        public WildcardPersonGroup(List<? extends Person> people) {
            this.people = people;
        }

        public List<? extends Person> getPeople() {
            return people;
        }
    }

    public static class WildcardPersonMapHolder {
        private final Map<String, ? extends Person> people;

        public WildcardPersonMapHolder(Map<String, ? extends Person> people) {
            this.people = people;
        }

        public Map<String, ? extends Person> getPeople() {
            return people;
        }
    }
}
