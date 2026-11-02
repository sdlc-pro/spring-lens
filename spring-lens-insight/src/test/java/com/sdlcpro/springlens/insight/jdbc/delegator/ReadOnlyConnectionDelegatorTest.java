package com.sdlcpro.springlens.insight.jdbc.delegator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.sql.Connection;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Savepoint;

import static org.junit.jupiter.api.Assertions.*;

class ReadOnlyConnectionDelegatorTest {

    private Connection mockConnection;
    private ReadOnlyConnectionDelegator delegator;

    @BeforeEach
    void setUp() {
        mockConnection = Mockito.mock(Connection.class);
        delegator = new ReadOnlyConnectionDelegator(mockConnection);
    }

    @Test
    void testConstructorInitialization() {
        assertNotNull(delegator);
    }

    @Test
    void testCreateStatement_NoArgs() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.createStatement()
        );
        assertEquals("Operation 'createStatement' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testCreateStatement_ResultSetTypeAndConcurrency() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.createStatement(1003, 1007)
        );
        assertEquals("Operation 'createStatement' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testCreateStatement_ResultSetTypeConcurrencyAndHoldability() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.createStatement(1003, 1007, 1)
        );
        assertEquals("Operation 'createStatement' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testSetAutoCommit() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.setAutoCommit(true)
        );
        assertEquals("Operation 'setAutoCommit' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testCommit() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.commit()
        );
        assertEquals("Operation 'commit' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testRollback_NoArgs() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.rollback()
        );
        assertEquals("Operation 'rollback' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testRollback_WithSavepoint() {
        Savepoint mockSavepoint = Mockito.mock(Savepoint.class);
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.rollback(mockSavepoint)
        );
        assertEquals("Operation 'rollback' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testSetSavepoint_NoArgs() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.setSavepoint()
        );
        assertEquals("Operation 'setSavepoint' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testSetSavepoint_WithName() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.setSavepoint("mySavepoint")
        );
        assertEquals("Operation 'setSavepoint' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testReleaseSavepoint() {
        Savepoint mockSavepoint = Mockito.mock(Savepoint.class);
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.releaseSavepoint(mockSavepoint)
        );
        assertEquals("Operation 'releaseSavepoint' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }

    @Test
    void testSetReadOnly_True_Allowed() throws Exception {
        assertDoesNotThrow(() -> delegator.setReadOnly(true));
        Mockito.verify(mockConnection).setReadOnly(true);
    }

    @Test
    void testSetReadOnly_False_ThrowsException() {
        SQLFeatureNotSupportedException exception = assertThrows(
                SQLFeatureNotSupportedException.class,
                () -> delegator.setReadOnly(false)
        );
        assertEquals("Operation 'setReadOnly' is not supported by ReadOnlyConnectionDelegator.", exception.getMessage());
    }
}