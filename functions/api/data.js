const summary = [
    //2011
    {
        year: 2011,
        total: {
            dollars: 102514.55,
            pounds: 65655.44
        },
        donations: 3615
    },
    //2012
    {
        year: 2012,
        total: {
            dollars: 391145.7,
            pounds: 242557.27
        },
        donations: 13389
    },
    //2013
    {
        year: 2013,
        total: {
            dollars: 1159813.34,
            pounds: 708587.96
        },
        donations: 47885
    },
    //2014
    {
        year: 2014,
        total: {
            dollars: 1104882.09,
            pounds: 702925.99
        },
        donations: 40277
    },
    //2015
    {
        year: 2015,
        total: {
            dollars: 1052881.48,
            pounds: 691616.79
        },
        donations: 40201
    },
    //2016
    {
        year: 2016,
        total: {
            dollars: 2578201.7,
            pounds: 2049000.02
        },
        donations: 86589
    },
    //2017
    {
        year: 2017,
        total: {
            dollars: 5245772,
            pounds: 3894251.30
        },
        donations: 148853
    },
    //2018
    {
        year: 2018,
        total: {
            dollars: 3307959.36,
            pounds: 2594961.80
        },
        donations: 88139
    },
    //2019
    {
        year: 2019,
        total: {
            dollars: 2739251.08,
            pounds: 2111250.38
        },
        donations: 81719
    },
    //2020
    {
        year: 2020,
        total: {
            dollars: 2827226.07,
            pounds: 2120590
        },
        donations: 73395
    },
    //2021
    {
        year: 2021,
        total: {
            dollars: 4435933.89,
            pounds: 3345156
        },
        donations: 84974
    }
];

function getTotals(){
    let model = {dollars: 0, pounds: 0, donations: 0};
    for(var item of summary){
        model.dollars += item.total.dollars;
        model.pounds += item.total.pounds;
        model.donations += item.donations;
    }
    model.dollars = parseFloat(model.dollars.toFixed(2));
    model.pounds = parseFloat(model.pounds.toFixed(2));

    return model;
}

module.exports = {
    summary,
    getTotals
}