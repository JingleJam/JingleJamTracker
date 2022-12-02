async function getRealTimeData(request, spreedsheet, query, year){

    const cache = await caches.open("jingle-jam-current");
    
    const cacheKey = new Request(request.url, request);

    let cacheResponse = await cache.match(cacheKey);
    
    if (!cacheResponse) {
        let sheetResponse = await fetch(`https://docs.google.com/spreadsheets/d/${spreedsheet}/gviz/tq?tq=${query}&headers=0&sheet=${year} Data Set&tqx=out:csv`);
    
        let csv = await sheetResponse.text();
    
        let rows = csv.split('\n');

        let results = [];
        for(let i = 1; i < rows.length; i++){
            let row = rows[i];
            let rawData = row.split('","');
    
            let data = []
            for(let entry of rawData){
                data.push(entry.replaceAll('"', '').replaceAll(',', '').replaceAll('$', '').replaceAll('£', ''));
            }
    
            results.push({
                timestamp: data[0],
                amountPounds: parseFloat(data[1]),
                amountDollars: parseFloat(data[2]),
                year: year
            });
        }
    
        let response = new Response(JSON.stringify(results));

        response.headers.append('content-type', 'application/json;charset=UTF-8');
        response.headers.append('Access-Control-Allow-Origin', '*');
        response.headers.append('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        response.headers.append('Access-Control-Max-Age', '86400');
        response.headers.append('Allow', 'GET, HEAD, OPTIONS');
        response.headers.append('Cache-Control', 's-maxage=1200');

        return response;
    }

    return cacheResponse;
}
  
async function getOldData(){
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
  
    let spreadsheet = context.env.GOOGLE_SHEETS_DOCUMENT;
    let query = context.env.GOOGLE_SHEETS_QUERY;
    let year = parseInt(context.env.YEAR);
  
    try{
        let results = await getRealTimeData(context.request, spreadsheet, query, year);

        if(results.length <= 2)
            throw "Error";

        return results;
    }
    catch{
        return await getOldData();
    }
  }
     