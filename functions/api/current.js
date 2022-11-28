async function getRawData(spreedsheet, query, year){
    let response = await fetch(`https://docs.google.com/spreadsheets/d/${spreedsheet}/gviz/tq?tq=${query}&headers=0&sheet=${year} Data Set&tqx=out:csv`);

    let csv = await response.text();

    let results = [];
    for(let row of csv.split('\n')){
        let rawData = row.split('","');

        let data = []
        for(let entry of rawData){
            data.push(entry.replace('"', '').replace(',', '').replace('$', '').replace('£', ''));
        }

        results.push({
            timestamp: data[0],
            amountPounds: parseFloat(data[1]),
            amountDollars: parseFloat(data[2]),
            year: year
        });
    }

    return results;
}

export async function onRequest(context) {
    let spreadsheet = context.env.GOOGLE_SHEETS_DOCUMENT;
    let query = context.env.GOOGLE_SHEETS_QUERY;
    let year = parseInt(context.env.YEAR);

    let data = await getRawData(spreadsheet, query, year);
    return new Response(JSON.stringify(data),
      {
        headers: {
          "content-type": "application/json;charset=UTF-8"
        }
      });
  }
     