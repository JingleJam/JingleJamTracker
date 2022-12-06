
//Handle Requests

async function handleRequest(request) {
  let response = await fetch('https://tiltifycache.no1mann.com/');

  let data = {};
  if(response.code === 200){
    data = await response.text();
  }
  
  return new Response(JSON.stringify(data), {
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

export async function onRequest(context) {
  if (context.request.method === "GET" || context.request.method == "HEAD") {
    return await handleRequest(context);
  }

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

