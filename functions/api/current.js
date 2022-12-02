
  
async function getRawData(){
    let response = await fetch('https://jingle-jam-current-data.no1mann.workers.dev/');

    return JSON.stringify(await response.json());
}

export async function onRequest(context) {
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
        return new Response(null,  {
            status: 204,
            headers: {
            "content-type": "application/json;charset=UTF-8",
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Max-Age': '86400',
            'Allow': 'GET, HEAD, OPTIONS'
            }
        });
    }
  
    return new Response(await getRawData(),
      {
        headers: {
          "content-type": "application/json;charset=UTF-8",
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Max-Age': '86400',
          'Allow': 'GET, HEAD, OPTIONS',
          'Vary': 'Origin'
        }
      });
  }
     