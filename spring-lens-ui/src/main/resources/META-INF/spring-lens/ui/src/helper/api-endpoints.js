/**
 * Enterprise API Endpoints Configuration.
 * Dynamically resolves base URLs based on window origin and context-path.
 */
function resolveEndpoints() {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const contextPath = pathname.split('/spring-lens/ui')[0];

    const apiBase = `${origin}${contextPath}/spring-lens/api`;
    const beansApi = `${apiBase}/beans`;
    const appApi = `${apiBase}/application`;

    return Object.freeze({
        // Application Health & Metadata
        APPLICATION_INFO: appApi,
        APPLICATION_HEALTH: `${appApi}/health`,

        // Bean Definitions
        BEAN_DEFINITION: `${beansApi}/definitions`,
        FIND_BEAN_DEFINITION: `${beansApi}/definitions/find`,
        SUMMARY_BEAN_DEFINITION: `${beansApi}/definitions/summary`,
        GRAPH_DEPENDENCIES: `${beansApi}/definitions/dependencies`,

        // Bean Instances & Telemetry
        BEAN_INSTANCE: `${beansApi}/instances`,
        FIND_BEAN_INSTANCE: `${beansApi}/instances/find`,
        PROXY_BEAN_INSTANCE: `${beansApi}/instances/proxy-info`,
        SUMMARY_BEAN_INSTANCE: `${beansApi}/instances/summary`,

        // Conditional Evaluation Reports
        CONDITIONAL_REPORTS: `${beansApi}/conditions`,
        FIND_CONDITIONAL_REPORTS: `${beansApi}/conditions/find`,
        SUMMARY_CONDITIONAL_REPORTS: `${beansApi}/conditions/summary`
    });
}

const ENDPOINTS = resolveEndpoints();
export default ENDPOINTS;
