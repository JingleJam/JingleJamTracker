const UPDATE_TIME_GRAPH = 60 * 1000; // Refresh cache every 60 seconds
const UPDATE_TIME_FREQ = 10; // Refresh graph every 10 minutes

const GRAPH_API_PATH = '/api/graph/current'; // API Path for the Graph Data
const TILTIFY_API_PATH = '/api/tiltify'; // API Path for the Tiltify Cache

export { 
    TILTIFY_API_PATH,
    GRAPH_API_PATH,
    UPDATE_TIME_GRAPH,
    UPDATE_TIME_FREQ
 };